// @flow

import type { RobotDriver } from './types';

// TODO: Implement a timeout to handle the case where we never get a
//       notification from the robot to say that a command has completed

// UUIDs from the Arduino example: ArduinoBLE / Peripheral / LED
const robotServiceUuid = '19b10000-e8f2-537e-4f6c-d104768a1214';
const commandCharacteristicUuid = '19b10001-e8f2-537e-4f6c-d104768a1214';
const notificationCharacteristicUuid = '19b10002-e8f2-537e-4f6c-d104768a1214';

export default class ArduinoDriver implements RobotDriver {
    commandCharacteristic: any;
    notificationCharacteristic: any;
    resolveActiveCommand: any;

    constructor() {
        this.commandCharacteristic = null;
        this.notificationCharacteristic = null;
        this.resolveActiveCommand = null;
    }

    connect(onDisconnected: () => void): Promise<void> {
        return new Promise((resolve, reject) => {
            (navigator: any).bluetooth.requestDevice({
                filters: [{ services: [robotServiceUuid] }]
            }).then((device) => {
                device.addEventListener('gattserverdisconnected', onDisconnected);
                return device.gatt.connect();
            }).then((server) => {
                return server.getPrimaryService(robotServiceUuid);
            }).then((service) => {
                return Promise.all(
                    [
                        service.getCharacteristic(commandCharacteristicUuid),
                        service.getCharacteristic(notificationCharacteristicUuid)
                    ]
                );
            }).then((characteristics) => {
                this.commandCharacteristic = characteristics[0];
                this.notificationCharacteristic = characteristics[1];
                this.notificationCharacteristic.addEventListener('characteristicvaluechanged', this.handleNotification);
                this.notificationCharacteristic.startNotifications().then(
                    /* eslint-disable no-console */
                    console.log('Notifications started')
                    /* eslint-enable no-console */
                );
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    sendCommand(bytes: Array<number>): Promise<void> {
        return new Promise((resolve) => {
            this.commandCharacteristic.writeValueWithResponse(new Uint8Array(bytes)).then(() => {
                /* eslint-disable no-console */
                console.log('Wrote to command characteristic');
                /* eslint-enable no-console */
                this.resolveActiveCommand = resolve;
            }).catch((e) => {
                /* eslint-disable no-console */
                console.log(e);
                /* eslint-enable no-console */
            });
        });
    }

    forward(): Promise<void> {
        return this.sendCommand([0x01]);
    }

    left45(): Promise<void> {
        return this.sendCommand([0x03]);
    }
	
    left90(): Promise<void> {
        return this.sendCommand([0x05]);
    }
	
	right45(): Promise<void> {
        return this.sendCommand([0x02]);
    }
	
    right90(): Promise<void> {
        return this.sendCommand([0x06]);
    }

    backward(): Promise<void> {
        return this.sendCommand([0x04]);
    }

    handleNotification = (event: any) => {
        if (event.target.value.getUint8(0) === 2) {
            /* eslint-disable no-console */
            console.log('Command completed');
            /* eslint-enable no-console */
            if (this.resolveActiveCommand) {
                this.resolveActiveCommand();
                this.resolveActiveCommand = null;
            }
        }
    };
}
