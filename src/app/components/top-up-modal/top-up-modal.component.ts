import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalController, IonButton, IonIcon, IonInput } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  walletOutline,
  checkmarkCircle,
  closeOutline,
  qrCodeOutline,
  arrowBackOutline,
  cashOutline,
  hourglassOutline,
  receiptOutline
} from 'ionicons/icons';
import QRCode from 'qrcode';
import { TopUpService } from '../../services/topup';
import { WalletService } from '../../services/wallet';
import { WalletQrService, WalletQrSettings } from '../../services/wallet-qr';

type TopUpStep = 'choose' | 'qr' | 'done';

/**
 * Content of the wallet Top Up modal:
 * amount choices -> QR code to scan with an online wallet -> success.
 */
@Component({
  selector: 'app-top-up-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonIcon, IonInput],
  templateUrl: './top-up-modal.component.html',
  styleUrls: ['./top-up-modal.component.scss']
})
export class TopUpModalComponent {
  private walletService = inject(WalletService);
  public walletQrService = inject(WalletQrService);
  private topupService = inject(TopUpService);
  private modalCtrl = inject(ModalController);

  step: TopUpStep = 'choose';
  /** True when the payment confirmation must be approved by the admin first. */
  needsApproval = false;
  requestId = '';

  presets: number[] = [100, 250, 500, 1000, 2000];
  selectedAmount: number | null = null;
  usingCustom = false;
  customAmount: number | null = null;

  reference = '';
  userReference = '';
  referenceError = '';
  qrDataUrl = '';
  paidAmount: number = 0;
  newBalance: number = 0;
  /** Which QR is shown: 'real' (uploaded image), 'qrph' (generated QR Ph), 'demo'. */
  qrMode: 'real' | 'qrph' | 'demo' = 'demo';

  // --- QR Ph (national QR standard) helpers -----------------------------

  /** EMV TLV tag-length-value encoder used by the QR Ph standard. */
  private tlv(id: string, value: string): string {
    const len = value.length.toString().padStart(2, '0');
    return id + len + value;
  }

  /** CRC-16/CCITT-FALSE checksum required by the QR Ph standard. */
  private crc16(payload: string): string {
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  /**
   * Builds a QR Ph person-to-person STATIC payload (BSP national standard) —
   * the same format GCash personal QRs use, so the GCash scanner accepts it.
   * The payer types the amount inside GCash after scanning.
   */
  private buildQrPhPayload(mobile: string, name: string, city: string): string {
    let num = (mobile || '').replace(/\D/g, '');
    if (num.startsWith('0')) num = '63' + num.slice(1);
    else if (!num.startsWith('63')) num = '63' + num;

    let payload = '';
    payload += this.tlv('00', '01');                                 // payload format
    payload += this.tlv('01', '11');                                 // 11 = static QR (like GCash personal QRs)
    payload += this.tlv('26', this.tlv('00', 'QRPH') + this.tlv('02', num)); // QR Ph P2P proxy
    payload += this.tlv('53', '608');                                // currency: PHP
    payload += this.tlv('58', 'PH');                                 // country
    payload += this.tlv('59', (name || 'Store').substring(0, 25));   // account name
    payload += this.tlv('60', (city || 'Manila').substring(0, 15));  // city
    payload += '6304';
    payload += this.crc16(payload);
    return payload;
  }

  // ----------------------------------------------------------------------

  constructor() {
    addIcons({
      walletOutline,
      checkmarkCircle,
      closeOutline,
      qrCodeOutline,
      arrowBackOutline,
      cashOutline,
      hourglassOutline,
      receiptOutline
    });
  }

  get amount(): number | null {
    if (this.usingCustom) {
      return this.customAmount !== null && this.customAmount > 0 ? this.customAmount : null;
    }
    return this.selectedAmount;
  }

  get canGenerate(): boolean {
    return this.amount !== null && this.amount > 0;
  }

  choosePreset(amount: number) {
    this.usingCustom = false;
    this.selectedAmount = amount;
    this.generateQr();
  }

  chooseCustom() {
    this.usingCustom = true;
    this.selectedAmount = null;
  }

  async generateQr() {
    const amt = this.amount;
    if (!amt || amt <= 0) return;

    this.reference = 'TU-' + Date.now().toString().slice(-8);
    this.userReference = '';
    this.referenceError = '';

    const settings = this.walletQrService.getSettings();
    let payload = '';

    if (settings.image) {
      // PREFERRED: the store's uploaded wallet payment QR — customers scan it
      // and send the payment to the store's real wallet account.
      this.qrDataUrl = settings.image;
      this.qrMode = 'real';
      this.step = 'qr';
      return;
    }

    if (settings.accountNumber && settings.accountName) {
      // Fallback: QR Ph — the national QR standard generated from the store's
      // registered mobile number (scannable in GCash/Maya).
      payload = this.buildQrPhPayload(settings.accountNumber, settings.accountName, settings.city);
      this.qrMode = 'qrph';
    } else {
      // Nothing configured — demo preview QR (not scannable in real wallets).
      this.qrMode = 'demo';
      payload = `FOODORDERING|TOPUP|REF:${this.reference}|AMOUNT:${amt.toFixed(2)}|CURRENCY:PHP`;
    }

    try {
      this.qrDataUrl = await QRCode.toDataURL(payload, {
        width: 512,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' }
      });
    } catch {
      this.qrDataUrl = '';
    }
    this.step = 'qr';
  }

  onReferenceChange() {
    if (this.referenceError) {
      this.referenceError = '';
    }
  }

  confirmPaid() {
    const amt = this.amount;
    if (!amt || amt <= 0) return;

    if (this.qrMode !== 'demo') {
      const trimmedRef = (this.userReference || '').trim();
      if (!trimmedRef) {
        this.referenceError = 'Please enter your payment reference number.';
        return;
      }
      if (trimmedRef.length < 4) {
        this.referenceError = 'Please enter a valid reference number (at least 4 characters).';
        return;
      }
      this.referenceError = '';
      this.reference = trimmedRef;
    }

    this.paidAmount = amt;

    if (this.qrMode === 'demo') {
      // Nothing configured — demo mode credits instantly (no real payment involved).
      this.needsApproval = false;
      this.walletService.topUp(amt);
      this.newBalance = this.walletService.getBalance();
    } else {
      // Real payment via the store QR / QR Ph: the admin confirms before the
      // wallet is credited.
      this.needsApproval = true;
      const req = this.topupService.submitPaymentRequest(amt, this.reference);
      this.requestId = req.id;
    }
    this.step = 'done';
  }

  backToChoose() {
    this.referenceError = '';
    this.step = 'choose';
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }
}