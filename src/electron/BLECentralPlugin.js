
function notSupported(failure) {
    console.log('BLE is not supported on the browser');
    if (failure) failure(new Error("not supported"));
}

function formatUUID(uuid) {
    if (uuid.startsWith('0x')) {
        return parseInt(uuid);
    }
    if (/^[0-9a-fA-F]+$/.test(uuid)) {
        return parseInt(uuid, 16);
    }
    return uuid;
}

module.exports = {
    deviceInfosByAddr: new Map(),
    deviceInfosByBrowserRef: new Map(),
    latestDeviceId: null,
    scanActive: false,

    storeDevice: function (deviceInfo) {
        this.deviceInfosByAddr.set(deviceInfo.id, deviceInfo);
        this.deviceInfosByBrowserRef.set(deviceInfo.browserRef, deviceInfo);
    },
    getDeviceByAddr: function (addr) {
        return this.deviceInfosByAddr.get(addr) || {};
    },
    getDeviceByBrowserRef: function (ref) {
        return this.deviceInfosByBrowserRef.get(ref) || {};
    },

    scan: function (services, seconds, success, failure) {
        return this.startScanWithOptions(services, {}, success, failure);
    },
    startScan: function (services, success, failure) {
        return this.startScanWithOptions(services, {}, success, failure);
    },
    startScanWithOptions: async function (services, options, success, failure) {
        await window.bleCentralPlugin.flushDeviceList();
        this.deviceInfosByAddr = new Map();
        this.deviceInfosByBrowserRef = new Map();

        window.bleCentralPlugin.handleLatestDeviceID((event, value) => {
            this.latestDeviceId = value;
        })

        if (!navigator.bluetooth) {
            failure('Bluetooth is not supported on this browser.');
            return;
        }

        let requestDeviceOptions = {};

        requestDeviceOptions.acceptAllDevices = true;
        requestDeviceOptions.filters = [];
        if (services && services.length) {
            requestDeviceOptions.acceptAllDevices = false;
            requestDeviceOptions.filters.push({
                services: services.map(formatUUID)
            });
        }

        if (options.requireManufacturerData) {
            // Specify this to have the scan filter only for devices that have this company
            // identifier in the manufacturer data
            requestDeviceOptions.acceptAllDevices = false;
            requestDeviceOptions.filters.push({
                "manufacturerData": [{
                    "companyIdentifier": options.requireManufacturerData
                }]
            });
        }

        if (options.authorizedServices && options.authorizedServices.length) {
            // Any services you want to access must be specified in "optionalServices" or
            // attempts to read/write will be denied after connection
            requestDeviceOptions.optionalServices = options.authorizedServices.map(formatUUID);
        }

        if (options.authorizedManufacturerData && options.authorizedManufacturerData.length) {
            // Any manufacturer data you want to read from advertising packets must be
            // specified in "optionalManufacturerData" or it will not be returned in the
            // advertising notifications
            requestDeviceOptions.optionalManufacturerData = options.authorizedManufacturerData;
        }

        this.scanActive = true;

        let processDevice = (device) => {
            console.log(device);

            if (this.latestDeviceId) {
                if (!this.scanActive) {
                    return;
                }

                let deviceInfo = this.getDeviceByBrowserRef(device.id);
                deviceInfo.device = device;
                deviceInfo.name = device.name;
                deviceInfo.id = this.latestDeviceId;
                deviceInfo.browserRef = device.id;
                this.storeDevice(deviceInfo);

                if (!device.watchingAdvertisements) {
                    device.addEventListener('advertisementreceived', (event) => {
                        let deviceInfo = this.getDeviceByBrowserRef(event.device.id);
                        deviceInfo.device = event.device;
                        deviceInfo.rssi = event.rssi;

                        if (!this.scanActive) {
                            // Todo- can we stop watching advertisements?
                            return;
                        }

                        var key = event.manufacturerData.keys().next().value;
                        if (key) {
                            var data = event.manufacturerData.get(key).buffer;

                            // Fake the normal format of advertising data
                            deviceInfo.advertising = new Uint8Array(data.byteLength + 4);
                            deviceInfo.advertising.set([3 + data.byteLength, 0xFF, key, key >> 8], 0);
                            deviceInfo.advertising.set(new Uint8Array(data), 4);
                        }

                        this.storeDevice(deviceInfo);

                        success({
                            id: deviceInfo.id,
                            name: deviceInfo.name,
                            advertising: deviceInfo.advertising,
                            rssi: deviceInfo.rssi,
                        })
                    });

                    device.watchAdvertisements();
                }

                success({
                    id: deviceInfo.id,
                    name: deviceInfo.name,
                    advertising: deviceInfo.advertising,
                    rssi: deviceInfo.rssi,
                });

                this.latestDeviceId = null;
            }
        }

        let continueScan = () => {
            navigator.bluetooth.requestDevice(requestDeviceOptions).then(device => {
                processDevice(device);
                continueScan();
            }).catch(failure);
        }

        continueScan();
    },
    stopScan: function (success, failure) {
        this.scanActive = false;
        if (success) success();
    },
    connect: function (deviceId, success, failure) {
        const connectGatt = (gatt) => {
            return gatt.connect().then(server => {
                let deviceInfo = this.getDeviceByAddr(deviceId);
                deviceInfo.server = server;

                this.storeDevice(deviceInfo);

                success();
            }).catch(err => {
                if (failure) failure(err);
            });
        };

        const deviceInfo = this.getDeviceByAddr(deviceId);
        if (!deviceInfo) {
            failure(new Error('device not found'));
        }
        if (deviceInfo.server) {
            success();
        } else {
            return connectGatt(deviceInfo.device.gatt);
        }
    },
    disconnect: function (deviceId, success, failure) {
        var deviceInfo = this.getDeviceByAddr(deviceId)
        if (deviceInfo) {
            var device = deviceInfo.server && deviceInfo.server.device;
            if (device && device.gatt.connected) {
                device.gatt.disconnect();
                success(device);
            } else {
                success();
            }
        } else if (failure) {
            failure(new Error("Peripheral not found"));
        }
    },
    read: function (deviceId, service_uuid, characteristic_uuid, success, failure) {
        const deviceInfo = this.getDeviceByAddr(deviceId);
        if (deviceInfo) {
            deviceInfo.server.getPrimaryService(formatUUID(service_uuid)).then(service => {
                return service.getCharacteristic(formatUUID(characteristic_uuid));
            }).then(characteristic => {
                return characteristic.readValue();
            }).then(result => {
                success(result.buffer);
            }).catch(error => {
                if (failure) failure(error);
            });
        } else if (failure) {
            failure();
        }
    },
    readRSSI: function (deviceId, success, failure) {
        notSupported();
        if (failure) failure(new Error("not supported"));
    },
    write: function (deviceId, service_uuid, characteristic_uuid, data, success, failure) {
        const deviceInfo = this.getDeviceByAddr(deviceId);
        if (deviceInfo) {
            deviceInfo.server.getPrimaryService(formatUUID(service_uuid)).then(service => {
                return service.getCharacteristic(formatUUID(characteristic_uuid));
            }).then(characteristic => {
                return characteristic.writeValueWithResponse(data);
            }).then(result => {
                if (success) success(result);
            }).catch(error => {
                if (failure) failure(error);
            });
        } else if (failure) {
            failure(new Error("device not connected"));
        }
    },
    writeWithoutResponse: function (deviceId, service_uuid, characteristic_uuid, data, success, failure) {
        const deviceInfo = this.getDeviceByAddr(deviceId);
        if (deviceInfo) {
            deviceInfo.server.getPrimaryService(formatUUID(service_uuid)).then(service => {
                return service.getCharacteristic(formatUUID(characteristic_uuid));
            }).then(characteristic => {
                return characteristic.writeWithoutResponse(data);
            }).then(result => {
                success(result);
            }).catch(error => {
                if (failure) failure(error);
            });
        } else if (failure) {
            failure(new Error("device not connected"));
        }
    },
    startNotification: function (deviceId, service_uuid, characteristic_uuid, success, failure) {
        const deviceInfo = this.getDeviceByAddr(deviceId);
        if (deviceInfo) {
            deviceInfo.server.getPrimaryService(formatUUID(service_uuid)).then(service => {
                return service.getCharacteristic(formatUUID(characteristic_uuid));
            }).then(characteristic => {
                return characteristic.startNotifications().then(result => {
                    characteristic.addEventListener('characteristicvaluechanged', function (event) {
                        success(event.target.value.buffer);
                    });
                });
            }).catch(error => {
                if (failure) failure(error);
            })
        } else if (failure) {
            failure(new Error("device not connected"));
        }
    },
    stopNotifcation: function (deviceId, service_uuid, characteristic_uuid, success, failure) {
        const deviceInfo = this.getDeviceByAddr(deviceId);
        if (deviceInfo) {
            deviceInfo.server.getPrimaryService(formatUUID(service_uuid)).then(service => {
                return service.getCharacteristic(formatUUID(characteristic_uuid));
            }).then(characteristic => {
                return characteristic.stopNotifications();
            }).then(result => {
                success(result);
            }).catch(error => {
                if (failure) failure(error);
            });
        } else if (failure) {
            failure(new Error("device not connected"));
        }
    },
    isEnabled: function (success, failure) {
        notSupported(failure);
    },
    isConnected: function (deviceId, success, failure) {
        const deviceInfo = this.getDeviceByAddr(deviceId);
        if (deviceInfo) {
            var device = deviceInfo.server.device;
            if (device.gatt.connected) {
                success();
            } else {
                if (failure) failure();
            }
        } else if (failure) {
            failure();
        }
    },
    showBluetoothSettings: function (success, failure) {
        notSupported(failure);
    },
    enable: function (success, failure) {
        notSupported(failure);
    },
    startStateNotifications: function (success, failure) {
        notSupported(failure);
    },
    stopStateNotifications: function (success, failure) {
        notSupported(failure);
    }
};
