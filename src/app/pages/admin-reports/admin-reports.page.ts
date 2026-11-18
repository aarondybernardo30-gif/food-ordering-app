import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  IonTitle,
  IonContent,
  IonModal,
  IonCard,
  IonCardTitle,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  statsChartOutline,
  cashOutline,
  receiptOutline,
  checkmarkDoneOutline,
  timeOutline,
  pulseOutline,
  restaurantOutline,
  documentTextOutline,
  closeOutline,
  personOutline,
  imageOutline,
  menuOutline,
  bicycleOutline,
  bagHandleOutline,
  downloadOutline,
  printOutline
} from 'ionicons/icons';
import { OrderService } from '../../services/order';
import { AuthService } from '../../services/auth';
import { AdminSidebarComponent, AdminTabKey, AdminNavDest } from '../../components/admin-sidebar/admin-sidebar.component';
import { Order, CartItem } from '../../models/food.model';

interface StatusRow {
  label: string;
  count: number;
  percent: number;
  cls: string;
}

interface TypeSummary {
  count: number;
  revenue: number;
  completed: number;
}

type OrderTypeFilter = 'all' | 'dine-in' | 'delivery' | 'pickup';

interface XlsxCell {
  value: string | number;
  style: number;
  isNumber?: boolean;
}

@Component({
  selector: 'app-admin-reports',
  templateUrl: './admin-reports.page.html',
  styleUrls: ['./admin-reports.page.scss'],
  standalone: true,
  imports: [
    IonCardTitle,
    IonCard,
    CommonModule,
    DatePipe,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonTitle,
    IonContent,
    IonModal,
    AdminSidebarComponent
  ]
})
export class AdminReportsPage implements OnInit {
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private toastCtrl = inject(ToastController);

  orders: Order[] = [];
  selectedOrderType: OrderTypeFilter = 'all';

  dineInSummary: TypeSummary = { count: 0, revenue: 0, completed: 0 };
  deliverySummary: TypeSummary = { count: 0, revenue: 0, completed: 0 };
  pickupSummary: TypeSummary = { count: 0, revenue: 0, completed: 0 };

  totalOrders = 0;
  totalRevenue = 0;
  grossRevenue = 0;
  cancelledRevenue = 0;
  completedCount = 0;
  activeCount = 0;
  cancelledCount = 0;
  avgOrderValue = 0;

  statusRows: StatusRow[] = [];
  topItems: { name: string; qty: number; revenue: number }[] = [];
  filteredOrders: Order[] = [];

  constructor() {
    addIcons({
      arrowBackOutline,
      statsChartOutline,
      cashOutline,
      receiptOutline,
      checkmarkDoneOutline,
      timeOutline,
      pulseOutline,
      restaurantOutline,
      documentTextOutline,
      closeOutline,
      personOutline,
      imageOutline,
      menuOutline,
      bicycleOutline,
      bagHandleOutline,
      downloadOutline,
      printOutline
    });
  }

  ngOnInit() {
    this.orderService.orders$.subscribe((data) => {
      this.orders = data || [];
      this.buildReport();
      if (this.selectedReportOrder) {
        const latest = this.orders.find((o) => o.id === this.selectedReportOrder?.id);
        if (latest) this.selectedReportOrder = latest;
      }
      this.cdr.detectChanges();
    });
  }

  ionViewWillEnter() {
    this.orders = this.orderService.getStoredOrders();
    this.buildReport();
    this.cdr.detectChanges();
  }

  get selectedTypeLabel(): string {
    switch (this.selectedOrderType) {
      case 'dine-in': return 'Dine-In';
      case 'delivery': return 'Delivery';
      case 'pickup': return 'Pick-Up';
      default: return 'All Orders';
    }
  }

  setOrderTypeFilter(type: OrderTypeFilter) {
    this.selectedOrderType = type;
    this.buildReport();
  }

  orderTypeLabel(type?: Order['orderType']): string {
    switch (type) {
      case 'dine-in': return 'Dine-In';
      case 'delivery': return 'Delivery';
      case 'pickup': return 'Pick-Up';
      default: return type || '—';
    }
  }

  orderLocationDetail(order: Order): string {
    if (order.orderType === 'dine-in' && order.tableNumber) {
      return `Table ${order.tableNumber}`;
    }
    if (order.orderType === 'delivery' && order.deliveryAddress) {
      return order.deliveryAddress;
    }
    if (order.orderType === 'pickup' && order.pickupTime) {
      return `Pick-Up Time: ${order.pickupTime}`;
    }
    return '';
  }

  formatOrderItems(order: Order): string {
    return (order.items || [])
      .map((it) => {
        const variant = this.variantLabel(it.selectedOption);
        const vLabel = variant ? ` (${variant})` : '';
        return `${it.quantity || 1}x ${it.food?.name || 'Item'}${vLabel}`;
      })
      .join(', ');
  }

  goBackToDashboard() {
    this.router.navigate(['/admin']);
  }

  // --- Shared sidebar wiring ---
  onDrawerTab(key: AdminTabKey) {
    this.router.navigate(['/admin'], { queryParams: { tab: key } });
  }

  onDrawerNavigate(dest: AdminNavDest) {
    if (dest === 'reports') {
      return;
    }
    this.router.navigate(['/rider-auth']);
  }

  onAdminLogout() {
    this.authService.adminLogout();
    this.router.navigate(['/admin-auth']);
  }

  private summarizeType(list: Order[], type: Order['orderType']): TypeSummary {
    const matching = list.filter((o) => o.orderType === type);
    const valid = matching.filter((o) => o.status !== 'Cancelled');
    return {
      count: matching.length,
      revenue: valid.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      completed: matching.filter((o) => o.status === 'Completed').length
    };
  }

  private buildReport() {
    const allOrders = this.orders;

    // Breakdown across all three order types (excludes Cancelled from revenue)
    this.dineInSummary = this.summarizeType(allOrders, 'dine-in');
    this.deliverySummary = this.summarizeType(allOrders, 'delivery');
    this.pickupSummary = this.summarizeType(allOrders, 'pickup');

    // Filtered list for active tab
    const scoped = this.selectedOrderType === 'all'
      ? allOrders
      : allOrders.filter((o) => o.orderType === this.selectedOrderType);

    const validOrders = scoped.filter((o) => o.status !== 'Cancelled');
    const cancelledOrders = scoped.filter((o) => o.status === 'Cancelled');

    this.totalOrders = scoped.length;
    this.totalRevenue = validOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    this.cancelledRevenue = cancelledOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    this.grossRevenue = this.totalRevenue + this.cancelledRevenue;
    this.completedCount = scoped.filter((o) => o.status === 'Completed').length;
    this.activeCount = scoped.filter((o) => o.status !== 'Completed' && o.status !== 'Cancelled').length;
    this.cancelledCount = cancelledOrders.length;
    this.avgOrderValue = validOrders.length > 0 ? this.totalRevenue / validOrders.length : 0;

    // Orders by status
    const statusLabels: { key: Order['status']; label: string; cls: string }[] = [
      { key: 'Pending', label: 'Pending', cls: 'pending' },
      { key: 'Preparing', label: 'Preparing', cls: 'preparing' },
      { key: 'Out for Delivery', label: 'Out for Delivery', cls: 'delivery' },
      { key: 'Ready for Pickup', label: 'Ready for Pickup', cls: 'pickup' },
      { key: 'Completed', label: 'Completed', cls: 'completed' },
      { key: 'Cancelled', label: 'Cancelled', cls: 'cancelled' }
    ];
    this.statusRows = statusLabels
      .map(({ key, label, cls }) => {
        const count = scoped.filter((o) => o.status === key).length;
        return {
          label,
          count,
          cls,
          percent: this.totalOrders > 0 ? Math.round((count / this.totalOrders) * 100) : 0
        };
      })
      .filter((row) => row.count > 0);

    // Top selling items (valid non-cancelled orders only)
    const itemStats = new Map<string, { qty: number; revenue: number }>();
    for (const order of validOrders) {
      for (const item of order.items || []) {
        const name = item.food?.name || 'Unknown item';
        const qty = item.quantity || 0;
        const lineRev = this.itemLineTotal(item);
        const prev = itemStats.get(name) || { qty: 0, revenue: 0 };
        itemStats.set(name, { qty: prev.qty + qty, revenue: prev.revenue + lineRev });
      }
    }
    this.topItems = Array.from(itemStats.entries())
      .map(([name, stats]) => ({ name, qty: stats.qty, revenue: stats.revenue }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // Filtered orders sorted newest first
    this.filteredOrders = [...scoped].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // ==========================================================
  // REAL .XLSX EXCEL EXPORT (Centered Text, Clear Math & Print Fit)
  // ==========================================================
  async exportToExcel() {
    if (this.filteredOrders.length === 0) {
      const toast = await this.toastCtrl.create({
        message: `No ${this.selectedTypeLabel.toLowerCase()} orders to export.`,
        color: 'warning',
        duration: 2000,
        position: 'top'
      });
      await toast.present();
      return;
    }

    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10);
    const typeSlug = this.selectedOrderType === 'all' ? 'all-orders' : this.selectedOrderType;
    const filename = `sales-report-${typeSlug}-${dateStamp}.xlsx`;

    const rows: XlsxCell[][] = [];
    const merges: string[] = [
      'A1:K1',
      'A2:K2',
      'A4:B4', 'E4:F4',
      'A5:B5', 'E5:F5',
      'A6:B6', 'E6:F6',
      'A7:B7', 'E7:F7',
      'A8:B8',
      'A9:B9',
      'A10:B10'
    ];

    // Row 1: Title Banner (centered A1:K1)
    rows.push([{ value: `Food Ordering Sales Report — ${this.selectedTypeLabel}`, style: 1 }]);
    // Row 2: Generated timestamp (centered A2:K2)
    rows.push([{ value: `Generated on: ${now.toLocaleString()}   |   Note: Cancelled orders are struck through and excluded from Net Sales`, style: 2 }]);
    // Row 3: Blank spacer
    rows.push([]);

    // Row 4: Summary & Service Breakdown Headers
    rows.push([
      { value: 'REPORT SUMMARY', style: 3 },
      { value: '', style: 3 },
      { value: 'Value', style: 3 },
      { value: '', style: 0 },
      { value: 'SERVICE TYPE BREAKDOWN', style: 3 },
      { value: '', style: 3 },
      { value: 'Orders', style: 3 },
      { value: 'Completed', style: 3 },
      { value: 'Net Sales (₱)', style: 3 }
    ]);

    // Row 5
    rows.push([
      { value: 'Total Orders', style: 5 },
      { value: '', style: 5 },
      { value: this.totalOrders, style: 7, isNumber: true },
      { value: '', style: 0 },
      { value: 'Dine-In', style: 5 },
      { value: '', style: 5 },
      { value: this.dineInSummary.count, style: 7, isNumber: true },
      { value: this.dineInSummary.completed, style: 7, isNumber: true },
      { value: Number(this.dineInSummary.revenue.toFixed(2)), style: 6, isNumber: true }
    ]);

    // Row 6
    rows.push([
      { value: 'Completed Orders', style: 5 },
      { value: '', style: 5 },
      { value: this.completedCount, style: 7, isNumber: true },
      { value: '', style: 0 },
      { value: 'Delivery', style: 5 },
      { value: '', style: 5 },
      { value: this.deliverySummary.count, style: 7, isNumber: true },
      { value: this.deliverySummary.completed, style: 7, isNumber: true },
      { value: Number(this.deliverySummary.revenue.toFixed(2)), style: 6, isNumber: true }
    ]);

    // Row 7
    rows.push([
      { value: 'Active Orders', style: 5 },
      { value: '', style: 5 },
      { value: this.activeCount, style: 7, isNumber: true },
      { value: '', style: 0 },
      { value: 'Pick-Up', style: 5 },
      { value: '', style: 5 },
      { value: this.pickupSummary.count, style: 7, isNumber: true },
      { value: this.pickupSummary.completed, style: 7, isNumber: true },
      { value: Number(this.pickupSummary.revenue.toFixed(2)), style: 6, isNumber: true }
    ]);

    // Row 8
    rows.push([
      { value: 'Cancelled Orders', style: 5 },
      { value: '', style: 5 },
      { value: this.cancelledCount, style: 7, isNumber: true }
    ]);

    // Row 9
    rows.push([
      { value: 'Net Sales (Excl. Cancelled)', style: 8 },
      { value: '', style: 8 },
      { value: Number(this.totalRevenue.toFixed(2)), style: 9, isNumber: true }
    ]);

    // Row 10
    rows.push([
      { value: 'Average Valid Order Value', style: 5 },
      { value: '', style: 5 },
      { value: Number(this.avgOrderValue.toFixed(2)), style: 6, isNumber: true }
    ]);

    // Row 11: Blank spacer
    rows.push([]);

    // Row 12: Orders Table Header
    rows.push([
      { value: 'Order ID', style: 4 },
      { value: 'Date & Time', style: 4 },
      { value: 'Order Type', style: 4 },
      { value: 'Customer Name', style: 4 },
      { value: 'Phone Number', style: 4 },
      { value: 'Table / Address / Pick-Up', style: 4 },
      { value: 'Assigned Rider', style: 4 },
      { value: 'Items Ordered', style: 4 },
      { value: 'Payment Method', style: 4 },
      { value: 'Status', style: 4 },
      { value: 'Amount (₱)', style: 4 }
    ]);

    for (const order of this.filteredOrders) {
      const isCancelled = order.status === 'Cancelled';
      const textStyle = isCancelled ? 10 : 5;
      const amtStyle = isCancelled ? 11 : 6;

      const itemsText = this.formatOrderItems(order);
      const locationOrTime =
        order.orderType === 'dine-in'
          ? (order.tableNumber ? `Table ${order.tableNumber}` : 'Dine-In')
          : order.orderType === 'delivery'
          ? (order.deliveryAddress || '—')
          : (order.pickupTime ? `Pick-Up: ${order.pickupTime}` : 'Pick-Up');

      const riderText = order.assignedRiderName
        ? `${order.assignedRiderName}${order.assignedRiderPhone ? ' (' + order.assignedRiderPhone + ')' : ''}`
        : '—';

      rows.push([
        { value: `#${order.id}`, style: textStyle },
        { value: new Date(order.createdAt).toLocaleString(), style: textStyle },
        { value: this.orderTypeLabel(order.orderType), style: textStyle },
        { value: order.customerName || 'Guest', style: textStyle },
        { value: order.customerPhone || '—', style: textStyle },
        { value: locationOrTime, style: textStyle },
        { value: riderText, style: textStyle },
        { value: itemsText || '—', style: textStyle },
        { value: this.orderPaymentLabel(order), style: textStyle },
        { value: order.status, style: textStyle },
        { value: Number((order.totalAmount || 0).toFixed(2)), style: amtStyle, isNumber: true }
      ]);
    }

    // Clear Footer Breakdown (Gross - Cancelled = Net Sales)
    const grossRowNum = rows.length + 1;
    merges.push(`H${grossRowNum}:J${grossRowNum}`);
    rows.push([
      { value: '', style: 0 },
      { value: '', style: 0 },
      { value: '', style: 0 },
      { value: '', style: 0 },
      { value: '', style: 0 },
      { value: '', style: 0 },
      { value: '', style: 0 },
      { value: 'GROSS ORDERS TOTAL', style: 12 },
      { value: '', style: 12 },
      { value: '', style: 12 },
      { value: Number(this.grossRevenue.toFixed(2)), style: 13, isNumber: true }
    ]);

    const cancelRowNum = rows.length + 1;
    merges.push(`H${cancelRowNum}:J${cancelRowNum}`);
    rows.push([
      { value: '', style: 0 },
      { value: '', style: 0 },
      { value: '', style: 0 },
      { value: '', style: 0 },
      { value: '', style: 0 },
      { value: '', style: 0 },
      { value: '', style: 0 },
      { value: 'LESS: CANCELLED ORDERS', style: 12 },
      { value: '', style: 12 },
      { value: '', style: 12 },
      { value: Number((-this.cancelledRevenue).toFixed(2)), style: 13, isNumber: true }
    ]);

    const netRowNum = rows.length + 1;
    merges.push(`H${netRowNum}:J${netRowNum}`);
    rows.push([
      { value: '', style: 0 },
      { value: '', style: 0 },
      { value: '', style: 0 },
      { value: '', style: 0 },
      { value: '', style: 0 },
      { value: '', style: 0 },
      { value: '', style: 0 },
      { value: 'NET SALES (VALID ORDERS)', style: 8 },
      { value: '', style: 8 },
      { value: '', style: 8 },
      { value: Number(this.totalRevenue.toFixed(2)), style: 9, isNumber: true }
    ]);

    const colWidths = [14, 23, 14, 22, 16, 28, 22, 34, 20, 18, 18];
    const blob = this.buildXlsxBlob(rows, colWidths, merges);
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const toast = await this.toastCtrl.create({
      message: `Downloaded ${this.selectedTypeLabel} Excel report (${filename})!`,
      color: 'success',
      duration: 2400,
      position: 'top'
    });
    await toast.present();
  }

  printReport() {
    window.print();
  }

  private xmlEscape(val: unknown): string {
    return String(val ?? '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private colLetter(colIndex: number): string {
    let n = colIndex;
    let out = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      out = String.fromCharCode(65 + rem) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  }

  private buildXlsxBlob(rows: XlsxCell[][], colWidths: number[], merges: string[]): Blob {
    const contentTypes =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>';

    const rootRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';

    const workbookXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="Sales Report" sheetId="1" r:id="rId1"/></sheets>' +
      '</workbook>';

    const workbookRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';

    const stylesXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;₱&quot;#,##0.00"/></numFmts>' +
      '<fonts count="8">' +
      '<font><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
      '<font><sz val="10"/><color rgb="FF475569"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFC2410C"/><name val="Calibri"/></font>' +
      '<font><strike/><sz val="11"/><color rgb="FF94A3B8"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="10"/><color rgb="FF475569"/><name val="Calibri"/></font>' +
      '</fonts>' +
      '<fills count="5">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFEE4D2D"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF7ED"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill>' +
      '</fills>' +
      '<borders count="2">' +
      '<border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border>' +
      '<left style="thin"><color rgb="FFCBD5E1"/></left>' +
      '<right style="thin"><color rgb="FFCBD5E1"/></right>' +
      '<top style="thin"><color rgb="FFCBD5E1"/></top>' +
      '<bottom style="thin"><color rgb="FFCBD5E1"/></bottom>' +
      '<diagonal/>' +
      '</border>' +
      '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="14">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="164" fontId="5" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="6" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="164" fontId="6" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="7" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="164" fontId="7" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';

    const colsXml = colWidths
      .map((w, idx) => `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`)
      .join('');

    const rowsXml = rows
      .map((cells, rIdx) => {
        const rowNum = rIdx + 1;
        const heightAttr = rowNum === 1 ? ' ht="30" customHeight="1"' : rowNum === 2 ? ' ht="20" customHeight="1"' : '';
        if (!cells || cells.length === 0) {
          return `<row r="${rowNum}"${heightAttr}/>`;
        }
        const cellsXml = cells
          .map((cell, cIdx) => {
            const ref = `${this.colLetter(cIdx + 1)}${rowNum}`;
            if (cell.isNumber && typeof cell.value === 'number' && !isNaN(cell.value)) {
              return `<c r="${ref}" s="${cell.style}"><v>${cell.value}</v></c>`;
            }
            return `<c r="${ref}" t="inlineStr" s="${cell.style}"><is><t>${this.xmlEscape(cell.value)}</t></is></c>`;
          })
          .join('');
        return `<row r="${rowNum}"${heightAttr}>${cellsXml}</row>`;
      })
      .join('');

    const mergesXml = merges.length > 0
      ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
      : '';

    const sheetXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
      '<sheetViews><sheetView workbookViewId="0"/></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="20"/>' +
      `<cols>${colsXml}</cols>` +
      `<sheetData>${rowsXml}</sheetData>` +
      mergesXml +
      '<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>' +
      '</worksheet>';

    return this.buildZipBlob([
      { name: '[Content_Types].xml', content: contentTypes },
      { name: '_rels/.rels', content: rootRels },
      { name: 'xl/workbook.xml', content: workbookXml },
      { name: 'xl/_rels/workbook.xml.rels', content: workbookRels },
      { name: 'xl/styles.xml', content: stylesXml },
      { name: 'xl/worksheets/sheet1.xml', content: sheetXml }
    ]);
  }

  private buildZipBlob(entries: { name: string; content: string }[]): Blob {
    const encoder = new TextEncoder();
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate =
      ((Math.max(1980, now.getFullYear()) - 1980) << 9) |
      ((now.getMonth() + 1) << 5) |
      now.getDate();

    const localChunks: Uint8Array[] = [];
    const centralChunks: Uint8Array[] = [];
    let offset = 0;

    for (const entry of entries) {
      const nameBytes = encoder.encode(entry.name);
      const dataBytes = encoder.encode(entry.content);
      const crc = this.crc32(dataBytes);

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(localHeader.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, dosTime, true);
      lv.setUint16(12, dosDate, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, dataBytes.length, true);
      lv.setUint32(22, dataBytes.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      localChunks.push(localHeader, dataBytes);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(centralHeader.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dosTime, true);
      cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, dataBytes.length, true);
      cv.setUint32(24, dataBytes.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      centralHeader.set(nameBytes, 46);

      centralChunks.push(centralHeader);
      offset += localHeader.length + dataBytes.length;
    }

    const centralSize = centralChunks.reduce((sum, c) => sum + c.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    return new Blob([...localChunks, ...centralChunks, eocd] as BlobPart[], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  private crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc ^= bytes[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : (crc >>> 1);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  // --- ORDER DETAILS MODAL (clickable customer names in Orders Report) ---
  selectedReportOrder: Order | null = null;
  isOrderDetailsOpen: boolean = false;
  isProofFullViewOpen: boolean = false;

  openOrderDetails(order: Order) {
    this.selectedReportOrder = order;
    this.isOrderDetailsOpen = true;
    this.isProofFullViewOpen = false;
  }

  closeOrderDetails() {
    this.isOrderDetailsOpen = false;
    this.selectedReportOrder = null;
    this.isProofFullViewOpen = false;
  }

  closeProofFullView() {
    this.isProofFullViewOpen = false;
  }

  itemUnitPrice(item: CartItem): number {
    if (typeof item.unitPrice === 'number') return item.unitPrice;
    return item.food?.price || 0;
  }

  itemLineTotal(item: CartItem): number {
    return this.itemUnitPrice(item) * (item.quantity || 1);
  }

  /** Strips embedded price tokens from variation strings ("Regular P90" -> "Regular"). */
  variantLabel(option?: string): string {
    if (!option) return '';
    return option.replace(/\s*\(?\s*\+?\s*(?:₱|P)\s*\d+(?:\.\d+)?\s*\)?\s*/gi, '').trim();
  }

  orderPaymentLabel(order: Order): string {
    switch (order.paymentMethod) {
      case 'cod':
        return order.orderType === 'delivery' ? 'Cash on Delivery' : 'Cash (At Counter)';
      case 'shopeepay':
        return 'Wallet (Paid)';
      case 'counter':
        return 'Pay at Counter';
      case 'online':
        return 'Paid Online';
      default:
        return order.paymentMethod || '—';
    }
  }
}