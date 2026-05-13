// Web Bluetooth manager with auto-reconnect, exponential backoff and
// persistent connection state across PWA restarts. Drives the live
// signal store from real Heart Rate Service notifications.

import { signal } from "./signal";

export type BleState =
  | "idle"
  | "scanning"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "unsupported";

export type BleLog = { ts: number; level: "info" | "warn" | "error" | "ok"; msg: string };

const STORAGE_KEY = "denex.ble.lastDevice";

type Listener = () => void;

type GattChar = {
  startNotifications: () => Promise<GattChar>;
  addEventListener: (t: string, cb: (ev: Event) => void) => void;
  readValue: () => Promise<DataView>;
  value?: DataView;
};
type GattService = { getCharacteristic: (uuid: string) => Promise<GattChar> };
type GattServer = {
  connected: boolean;
  connect: () => Promise<GattServer>;
  disconnect: () => void;
  getPrimaryService: (uuid: string) => Promise<GattService>;
};
type AnyBleDevice = {
  id: string;
  name?: string;
  gatt?: GattServer;
  addEventListener: (t: string, cb: () => void) => void;
  removeEventListener?: (t: string, cb: () => void) => void;
};

type BleNavigator = Navigator & {
  bluetooth: {
    requestDevice: (o: object) => Promise<AnyBleDevice>;
    getDevices?: () => Promise<AnyBleDevice[]>;
    getAvailability?: () => Promise<boolean>;
  };
};

class BluetoothManager {
  device: AnyBleDevice | null = null;
  state: BleState = "idle";
  battery = 0;
  rssi = 0;
  packetLoss = 0;
  logs: BleLog[] = [];
  autoReconnect = true;
  reconnectAttempts = 0;
  nextReconnectAt = 0;
  lastError: string | null = null;

  private listeners = new Set<Listener>();
  private hrChar: GattChar | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private notificationCount = 0;
  private notificationStart = 0;

  constructor() {
    if (typeof window !== "undefined") {
      this.loadAutoReconnect();
      // Best-effort silent restore once the page boots.
      queueMicrotask(() => this.tryRestore());
    }
  }

  subscribe(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
  private emit() { for (const l of this.listeners) l(); }
  private log(level: BleLog["level"], msg: string) {
    this.logs = [{ ts: Date.now(), level, msg }, ...this.logs].slice(0, 80);
    this.emit();
  }

  isSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  setAutoReconnect(v: boolean) {
    this.autoReconnect = v;
    try { localStorage.setItem("denex.ble.autoReconnect", v ? "1" : "0"); } catch { /* noop */ }
    this.emit();
  }
  private loadAutoReconnect() {
    try {
      const raw = localStorage.getItem("denex.ble.autoReconnect");
      if (raw !== null) this.autoReconnect = raw === "1";
    } catch { /* noop */ }
  }

  private persistDevice(d: AnyBleDevice) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: d.id, name: d.name ?? null, ts: Date.now() }));
    } catch { /* noop */ }
  }
  private loadPersisted(): { id: string; name: string | null } | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as { id: string; name: string | null };
    } catch { return null; }
  }
  forgetDevice() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    this.log("info", "Forgot saved device");
    this.emit();
  }
  hasSavedDevice() { return this.loadPersisted() !== null; }
  savedDeviceName() { return this.loadPersisted()?.name ?? null; }

  // Attempt to silently re-pair on startup using getDevices() (Chrome).
  async tryRestore() {
    if (!this.isSupported() || !this.autoReconnect) return;
    const saved = this.loadPersisted();
    if (!saved) return;
    const nav = navigator as BleNavigator;
    if (!nav.bluetooth.getDevices) return;
    try {
      const devices = await nav.bluetooth.getDevices();
      const match = devices.find((d) => d.id === saved.id);
      if (match) {
        this.log("info", `Restoring connection to ${match.name ?? saved.name ?? "device"}`);
        await this.attach(match);
      }
    } catch (e) {
      this.log("warn", `Restore failed: ${msg(e)}`);
    }
  }

  async scanAndConnect() {
    if (!this.isSupported()) {
      this.state = "unsupported";
      this.log("error", "Web Bluetooth is not supported in this browser.");
      this.emit();
      return;
    }
    this.cancelReconnect();
    try {
      this.state = "scanning"; this.lastError = null; this.emit();
      this.log("info", "Requesting BLE device…");
      const nav = navigator as BleNavigator;
      const device = await nav.bluetooth.requestDevice({
        filters: [{ services: ["heart_rate"] }],
        optionalServices: ["battery_service", "device_information"],
      });
      this.persistDevice(device);
      await this.attach(device);
    } catch (e) {
      this.lastError = msg(e);
      this.log("error", this.lastError);
      this.state = "idle";
      this.emit();
    }
  }

  private async attach(device: AnyBleDevice) {
    this.device = device;
    this.state = "connecting"; this.emit();
    try {
      const server = await device.gatt?.connect();
      if (!server) throw new Error("GATT connect failed");
      device.addEventListener("gattserverdisconnected", this.onDisconnected);

      // Heart rate notifications drive BPM in the signal store.
      try {
        const hrSvc = await server.getPrimaryService("heart_rate");
        const hrChar = await hrSvc.getCharacteristic("heart_rate_measurement");
        hrChar.addEventListener("characteristicvaluechanged", this.onHrChange);
        await hrChar.startNotifications();
        this.hrChar = hrChar;
        this.notificationCount = 0;
        this.notificationStart = performance.now();
        this.log("ok", "Subscribed to heart_rate_measurement");
      } catch (e) {
        this.log("warn", `HR service unavailable: ${msg(e)}`);
      }

      // Battery (optional).
      try {
        const batSvc = await server.getPrimaryService("battery_service");
        const batChar = await batSvc.getCharacteristic("battery_level");
        const v = await batChar.readValue();
        this.battery = v.getUint8(0);
      } catch { this.battery = 0; }

      this.state = "connected";
      this.reconnectAttempts = 0;
      signal.start();
      this.log("ok", `Connected to ${device.name ?? device.id}`);
      this.emit();
    } catch (e) {
      this.lastError = msg(e);
      this.log("error", `Connect failed: ${this.lastError}`);
      this.state = "disconnected";
      this.emit();
      this.scheduleReconnect();
    }
  }

  private onHrChange = (ev: Event) => {
    const target = ev.target as unknown as { value?: DataView };
    const v = target.value;
    if (!v) return;
    const flags = v.getUint8(0);
    const is16 = (flags & 0x1) === 0x1;
    const bpm = is16 ? v.getUint16(1, true) : v.getUint8(1);
    signal.pushBpm(bpm);
    this.notificationCount++;
    const elapsed = (performance.now() - this.notificationStart) / 1000;
    if (elapsed > 1) {
      const expected = Math.max(1, Math.round(elapsed));
      const got = this.notificationCount;
      this.packetLoss = Math.max(0, Math.min(20, ((expected - got) / expected) * 100));
    }
  };

  private onDisconnected = () => {
    this.log("warn", "Device disconnected");
    this.state = "disconnected";
    signal.stop();
    this.emit();
    if (this.autoReconnect) this.scheduleReconnect();
  };

  private scheduleReconnect() {
    if (!this.device || !this.autoReconnect) return;
    this.cancelReconnect();
    const delay = Math.min(30_000, 1000 * Math.pow(2, this.reconnectAttempts));
    this.reconnectAttempts++;
    this.nextReconnectAt = Date.now() + delay;
    this.state = "reconnecting"; this.emit();
    this.log("info", `Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.reconnectNow(), delay);
  }
  private cancelReconnect() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.nextReconnectAt = 0;
  }
  async reconnectNow() {
    if (!this.device) {
      // No live device handle (e.g. after a hard refresh) — try silent restore.
      await this.tryRestore();
      return;
    }
    this.state = "connecting"; this.emit();
    try {
      const server = await this.device.gatt?.connect();
      if (!server) throw new Error("GATT connect failed");
      this.state = "connected";
      this.reconnectAttempts = 0;
      signal.start();
      this.log("ok", "Reconnected");
      this.emit();
    } catch (e) {
      this.lastError = msg(e);
      this.log("error", `Reconnect failed: ${this.lastError}`);
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.cancelReconnect();
    this.autoReconnect = false; // explicit user action; resume only when toggled back on
    try { this.device?.gatt?.disconnect(); } catch { /* noop */ }
    this.state = "idle";
    this.device = null;
    this.hrChar = null;
    signal.stop();
    this.log("info", "Disconnected by user");
    this.emit();
  }
}

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

export const ble = new BluetoothManager();
