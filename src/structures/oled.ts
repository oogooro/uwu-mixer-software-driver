import { SerialCommand, SerialHandler } from './serialHandler';

export class Oled {
    private serial: SerialHandler;
    private displayActiveTimeout?: NodeJS.Timeout;
    displayActiveTime: number;

    constructor(serial: SerialHandler, displayActiveTime = 2000) {
        this.serial = serial;
        this.displayActiveTime = displayActiveTime;
    }

    private setDisplayActive() {
        clearInterval(this.displayActiveTimeout);

        this.displayActiveTimeout = setTimeout(() => {
            this.displayClear();
        }, this.displayActiveTime);
    }

    displayClear(): void {
        this.serial.sendCommand('o', ...SerialCommand.oledClear());
    }

    displayVolume(volume: number, channel: number): void {
        this.setDisplayActive();
        this.serial.sendCommand('o', ...SerialCommand.oledVolume(volume, channel));
    }

    displayMute(channel: number, unmute: boolean): void {
        this.setDisplayActive();
        this.serial.sendCommand('o', ...SerialCommand.oledMute(channel, unmute));
    }

    destroy(): void {
        clearTimeout(this.displayActiveTimeout);
    }
};