/**
 * @license
 * Copyright 2022-2023 Project CHIP Authors
 * SPDX-License-Identifier: Apache-2.0
 */

export function isDeepEqual(a: any, b: any) {
    if (
        a === null || a === undefined || b === null || b === undefined ||
        typeof a !== typeof b ||
        (typeof a !== 'object' && typeof b !== 'object')
    ) {
        return (a === b);
    }
    // Create arrays of property names
    const aProps = Object.getOwnPropertyNames(a);
    const bProps = Object.getOwnPropertyNames(b);

    // If number of properties is different,
    // objects are not equivalent
    if (aProps.length !== bProps.length) {
        return false;
    }

    for (let i = 0; i < aProps.length; i++) {
        const propName = aProps[i];

        if (typeof a[propName] !== typeof b[propName]) {
            return false;
        }
        if (typeof a[propName] === 'object') {
            if (!isDeepEqual(a[propName], b[propName])) {
                return false;
            }
        }
        else {
            // If values of same property are not equal,
            // objects are not equivalent
            if (a[propName] !== b[propName]) {
                return false;
            }
        }
    }

    // If we made it this far, objects
    // are considered equal
    return true;
}
