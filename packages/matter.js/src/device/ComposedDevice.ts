/**
 * @license
 * Copyright 2022 The matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */
import { Endpoint } from "./Endpoint.js";
import { Device } from "./Device.js";
import { DeviceTypeDefinition } from "./DeviceTypes.js";
import { AtLeastOne } from "../util/Array.js";

/**
 * A ComposedDevice is a special endpoint that allows to combine multiple sub devices and expose this as one device
 * (e.g. a fan and a light).
 */
export class ComposedDevice extends Endpoint {
    /**
     * Creates a new ComposedDevice.
     *
     * @param deviceTypes Array with Device types how this device should be presented to the Matter ecosystem.
     * @param devices Array with devices that should be combined into one device that are directly added.
     * @param endpointId Optional endpoint ID to use. If not provided will automatically be assigned
     */
    constructor(
        deviceTypes: AtLeastOne<DeviceTypeDefinition>,
        devices: Device[] = [],
        endpointId?: number
    ) {
        super(deviceTypes, endpointId);
        devices.forEach(device => this.addDevice(device));
    }

    /**
     * Add a sub-device to the composed device.
     * @param device Device instance to add
     */
    addDevice(device: Device) {
        this.addChildEndpoint(device);
    }

    /**
     * Get all sub-devices of the composed device.
     *
     * @returns Array with all sub-devices
     */
    getDevices() {
        return this.getChildEndpoints();
    }

    /**
     * Verify that the required clusters exists on the device.
     */
    protected override verifyRequiredClusters() {
        // TODO find out what to really check here and how ... most likely we need to verify that the added sub devices
        //      somehow match with the device types of the composed device?!
        //      For now we do not check this
        return;
    }
}
