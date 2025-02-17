/**
 * @license
 * Copyright 2022 The node-matter Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScenesCluster, TlvExtensionFieldSet } from "../ScenesCluster.js";
import { GroupId } from "../../datatype/GroupId.js";
import { StatusCode } from "../../protocol/interaction/InteractionProtocol.js";
import { ClusterServerHandlers } from "./ClusterServer.js";
import { MatterDevice } from "../../MatterDevice.js";
import { SecureSession } from "../../session/SecureSession.js";
import { Fabric } from "../../fabric/Fabric.js";
import { SessionType } from "../../codec/MessageCodec.js";
import { StatusResponseError } from "../../protocol/interaction/InteractionMessenger.js";
import { TypeFromSchema } from "../../tlv/TlvSchema.js";
import { GroupsManager } from "./GroupsServer.js";
import { ClusterId } from "../../datatype/ClusterId.js";
import { ClusterServer } from "../../protocol/interaction/InteractionServer.js";

interface scenesTableEntry {
    /** The group identifier for which this scene applies, or 0 if the scene is not associated with a group. */
    scenesGroupId: number;

    /** The identifier, unique within this group, which is used to identify this scene. */
    sceneId: number;

    /** The name of the scene (optional) */
    sceneName?: string;

    /** The amount of time, in seconds, it will take for a cluster to change from its current state to the requested state. */
    sceneTransitionTime: number;

    /**
     * See the Scene Table Extensions subsections of individual clusters. A Scene Table Extension SHALL only use attributes
     * marked with "S" in the Quality column of the cluster definition. Each extension field set holds a set of values of
     * these attributes for a cluster implemented on the same endpoint. The sum of all such sets defines a scene.
     */
    extensionFieldSets: TypeFromSchema<typeof TlvExtensionFieldSet>[];

    /** Together with the SceneTransitionTime field, this field allows the transition time to be specified in tenths of a second. */
    transitionTime100ms: number;
}

export class ScenesManager {
    static getEndpointScenes(fabric: Fabric, endpointId: number): Map<number, Map<number, scenesTableEntry>> | undefined {
        return fabric.getScopedClusterDataValue<Map<number, Map<number, scenesTableEntry>>>(ScenesCluster, endpointId.toString());
    }

    static setEndpointScenes(fabric: Fabric, endpointId: number, endpointScenes: Map<number, Map<number, scenesTableEntry>>) {
        fabric.setScopedClusterDataValue(ScenesCluster, endpointId.toString(), endpointScenes);
    }

    static setScenes(fabric: Fabric, endpointId: number, sceneEntries: scenesTableEntry[]) {
        let endpointScenes = ScenesManager.getEndpointScenes(fabric, endpointId);
        if (endpointScenes === undefined) {
            endpointScenes = new Map<number, Map<number, scenesTableEntry>>();
        }

        for (const sceneEntry of sceneEntries) {
            const { scenesGroupId, sceneId } = sceneEntry;
            let scenesGroupIdMap = endpointScenes.get(scenesGroupId);
            if (scenesGroupIdMap === undefined) {
                scenesGroupIdMap = new Map<number, scenesTableEntry>();
                endpointScenes.set(scenesGroupId, scenesGroupIdMap);
            }

            scenesGroupIdMap.set(sceneId, sceneEntry);
        }

        ScenesManager.setEndpointScenes(fabric, endpointId, endpointScenes);
    }

    static getSceneEntry(fabric: Fabric, endpointId: number, groupId: GroupId, sceneId: number): scenesTableEntry | undefined {
        return ScenesManager.getEndpointScenes(fabric, endpointId)?.get(groupId.id)?.get(sceneId);
    }

    static getAllScenes(fabric: Fabric, endpointId: number, groupId: GroupId): scenesTableEntry[] {
        const endpointScenes = ScenesManager.getEndpointScenes(fabric, endpointId);
        if (endpointScenes === undefined) return [];
        return Array.from(endpointScenes.get(groupId.id)?.values() ?? []);
    }

    static removeScene(fabric: Fabric, endpointId: number, groupId: GroupId, sceneId: number): boolean {
        const endpointScenes = ScenesManager.getEndpointScenes(fabric, endpointId);
        if (endpointScenes !== undefined) {
            const groupScenes = endpointScenes.get(groupId.id);
            if (groupScenes !== undefined) {
                if (groupScenes.delete(sceneId)) {
                    fabric.persist(); // persist scoped cluster data changes
                    return true;
                }
            }
        }
        return false;
    }

    static removeAllScenesForGroup(fabric: Fabric, endpointId: number, groupId: number) {
        const endpointScenes = ScenesManager.getEndpointScenes(fabric, endpointId);
        if (endpointScenes !== undefined) {
            if (endpointScenes.delete(groupId)) {
                fabric.persist(); // persist scoped cluster data changes
            }
        }
    }

    static removeAllNonGlobalScenesForEndpoint(fabric: Fabric, endpointId: number) {
        const endpointScenes = ScenesManager.getEndpointScenes(fabric, endpointId);
        if (endpointScenes !== undefined) {
            endpointScenes.forEach((_groupScenes, groupId) => {
                if (groupId !== 0) {
                    endpointScenes.delete(groupId);
                }
            });
            fabric.persist(); // persist scoped cluster data changes
        }
    }
}

export const ScenesClusterHandler: () => ClusterServerHandlers<typeof ScenesCluster> = () => {
    const addSceneLogic = (endpointId: number, groupId: GroupId, sceneId: number, sceneTransitionTime: number, sceneName: string, extensionFieldSets: any, transitionTime100ms: number, fabric: Fabric) => {

        if (groupId.id !== 0 && !GroupsManager.hasGroup(fabric, endpointId, groupId)) {
            return { status: StatusCode.InvalidCommand, groupId, sceneId };
        }

        if (groupId.id < 1 || sceneId < 1) {
            return { status: StatusCode.ConstraintError, groupId, sceneId };
        }
        if (groupId.id > 0xfff7) {
            return { status: StatusCode.ConstraintError, groupId, sceneId };
        }
        if (sceneName.length > 16) {
            return { status: StatusCode.ConstraintError, groupId, sceneId };
        }

        ScenesManager.setScenes(fabric, endpointId, [{
            scenesGroupId: groupId.id,
            sceneId,
            sceneName,
            sceneTransitionTime,
            extensionFieldSets,
            transitionTime100ms
        }]);

        return { status: StatusCode.Success, groupId, sceneId };
    };

    return {
        addScene: async ({ request: { groupId, sceneId, transitionTime, sceneName, extensionFieldSets }, session, message: { packetHeader: { sessionType } }, endpoint }) => {
            if (sessionType !== SessionType.Unicast) {
                throw new Error("Groupcast not supported");
                // TODO: When Unicast we generate a response, else not
            }

            return addSceneLogic(endpoint.getId(), groupId, sceneId, transitionTime, sceneName, extensionFieldSets, 0, (session as SecureSession<MatterDevice>).getAccessingFabric());
        },

        viewScene: async ({ request: { groupId, sceneId }, session, message: { packetHeader: { sessionType } }, endpoint }) => {

            if (sessionType !== SessionType.Unicast) {
                throw new Error("Groupcast not supported");
                // TODO: When Unicast we generate a response, else not
            }

            const fabric = (session as SecureSession<MatterDevice>).getAccessingFabric();

            if (groupId.id !== 0 && !GroupsManager.hasGroup(fabric, endpoint.getId(), groupId)) {
                return { status: StatusCode.InvalidCommand, groupId, sceneId };
            }

            const sceneEntry = ScenesManager.getSceneEntry(fabric, endpoint.getId(), groupId, sceneId);
            if (sceneEntry === undefined) {
                return { status: StatusCode.NotFound, groupId, sceneId };
            }
            const { sceneName, sceneTransitionTime, extensionFieldSets } = sceneEntry;

            return { status: StatusCode.Success, groupId, sceneId, sceneName, transitionTime: sceneTransitionTime, extensionFieldSets };
        },

        removeScene: async ({ request: { groupId, sceneId }, session, message: { packetHeader: { sessionType } }, endpoint }) => {
            if (sessionType !== SessionType.Unicast) {
                throw new Error("Groupcast not supported");
                // TODO: When Unicast we generate a response, else not
            }

            const fabric = (session as SecureSession<MatterDevice>).getAccessingFabric();

            if (groupId.id !== 0 && !GroupsManager.hasGroup(fabric, endpoint.getId(), groupId)) {
                return { status: StatusCode.InvalidCommand, groupId, sceneId };
            }

            if (ScenesManager.removeScene(fabric, endpoint.getId(), groupId, sceneId)) {
                return { status: StatusCode.Success, groupId, sceneId };
            }
            return { status: StatusCode.NotFound, groupId, sceneId };
        },

        removeAllScenes: async ({ request: { groupId }, session, message: { packetHeader: { sessionType } }, endpoint }) => {
            if (sessionType !== SessionType.Unicast) {
                throw new Error("Groupcast not supported");
                // TODO: When Unicast we generate a response, else not
            }

            const fabric = (session as SecureSession<MatterDevice>).getAccessingFabric();

            if (groupId.id !== 0 && !GroupsManager.hasGroup(fabric, endpoint.getId(), groupId)) {
                return { status: StatusCode.InvalidCommand, groupId };
            }

            ScenesManager.removeAllScenesForGroup(fabric, endpoint.getId(), groupId.id);

            return { status: StatusCode.Success, groupId };
        },

        storeScene: async ({ request: { groupId, sceneId }, session, attributes: { currentScene, currentGroup }, message: { packetHeader: { sessionType } }, endpoint }) => {
            if (sessionType !== SessionType.Unicast) {
                throw new Error("Groupcast not supported");
                // TODO: When Unicast we generate a response, else not
            }

            const fabric = (session as SecureSession<MatterDevice>).getAccessingFabric();

            if (groupId.id !== 0 && !GroupsManager.hasGroup(fabric, endpoint.getId(), groupId)) {
                return { status: StatusCode.InvalidCommand, groupId, sceneId };
            }

            const extensionFieldSets = new Array<TypeFromSchema<typeof TlvExtensionFieldSet>>();
            endpoint.getAllClusterServers().forEach((cluster) => {
                const attributeValueList = cluster._getSceneExtensionFieldSets();
                if (attributeValueList.length) {
                    extensionFieldSets.push({ clusterId: new ClusterId(cluster.id), attributeValueList });
                }
            });

            const newSceneEntry = {
                scenesGroupId: groupId.id,
                sceneId,
                sceneName: '',
                sceneTransitionTime: 0,
                extensionFieldSets: extensionFieldSets,
                transitionTime100ms: 0
            }

            const existingSceneEntry = ScenesManager.getSceneEntry(fabric, endpoint.getId(), groupId, sceneId);
            if (existingSceneEntry !== undefined) {
                newSceneEntry.sceneName = existingSceneEntry.sceneName ?? '';
                newSceneEntry.sceneTransitionTime = existingSceneEntry.sceneTransitionTime ?? 0;
            }

            ScenesManager.setScenes(fabric, endpoint.getId(), [newSceneEntry]);

            currentScene.set(sceneId);
            currentGroup.set(groupId);

            return { status: StatusCode.Success, groupId, sceneId };
        },

        recallScene: async ({ request: { groupId, sceneId, transitionTime }, attributes: { currentScene, currentGroup }, session, endpoint }) => {
            const fabric = (session as SecureSession<MatterDevice>).getAccessingFabric();

            if (groupId.id !== 0 && !GroupsManager.hasGroup(fabric, endpoint.getId(), groupId)) {
                throw new StatusResponseError(`Group ${groupId.id} does not exist on this endpoint`, StatusCode.InvalidCommand);
            }

            const existingSceneEntry = ScenesManager.getSceneEntry(fabric, endpoint.getId(), groupId, sceneId);
            if (existingSceneEntry === undefined) {
                throw new StatusResponseError(`Scene ${sceneId} does not exist for group ${groupId.id}`, StatusCode.NotFound);
            }

            const usedTransitionTime = transitionTime ?? (existingSceneEntry.sceneTransitionTime + existingSceneEntry.transitionTime100ms / 10);

            existingSceneEntry.extensionFieldSets.forEach((clusterData) => {
                const { clusterId, attributeValueList } = clusterData;
                const cluster = endpoint.getClusterServerById(clusterId.id);
                if (cluster !== undefined) {
                    cluster._setSceneExtensionFieldSets(attributeValueList, usedTransitionTime);
                }
            });
            currentScene.set(sceneId);
            currentGroup.set(groupId);
            // TODO: setSceneValid attribute to true
        },

        getSceneMembership: async ({ request: { groupId }, session, message: { packetHeader: { sessionType } }, endpoint }) => {

            if (sessionType !== SessionType.Unicast) {
                throw new Error("Groupcast not supported");
                // TODO: When Unicast we generate a response, else not
            }

            const fabric = (session as SecureSession<MatterDevice>).getAccessingFabric();

            const endpointScenes = ScenesManager.getAllScenes(fabric, endpoint.getId(), groupId);
            const capacity = endpointScenes.length < 0xff ? 0xfe - endpointScenes.length : 0;

            if (groupId.id !== 0 && !GroupsManager.hasGroup(fabric, endpoint.getId(), groupId)) {
                return { status: StatusCode.InvalidCommand, groupId, capacity };
            }

            const sceneList = endpointScenes.map(({ sceneId }) => sceneId);
            return { status: StatusCode.Success, groupId, capacity, sceneList };
        },

        enhancedAddScene: async ({ request: { groupId, sceneId, transitionTime, sceneName, extensionFieldSets }, session, message: { packetHeader: { sessionType } }, endpoint }) => {
            if (sessionType !== SessionType.Unicast) {
                throw new Error("Groupcast not supported");
                // TODO: When Unicast we generate a response, else not
            }

            return addSceneLogic(endpoint.getId(), groupId, sceneId, Math.floor(transitionTime / 10), sceneName, extensionFieldSets, transitionTime % 10, (session as SecureSession<MatterDevice>).getAccessingFabric());
        },

        enhancedViewScene: async ({ request: { groupId, sceneId }, session, message: { packetHeader: { sessionType } }, endpoint }) => {

            if (sessionType !== SessionType.Unicast) {
                throw new Error("Groupcast not supported");
                // TODO: When Unicast we generate a response, else not
            }

            const fabric = (session as SecureSession<MatterDevice>).getAccessingFabric();

            if (groupId.id !== 0 && !GroupsManager.hasGroup(fabric, endpoint.getId(), groupId)) {
                return { status: StatusCode.InvalidCommand, groupId, sceneId };
            }

            const sceneEntry = ScenesManager.getSceneEntry(fabric, endpoint.getId(), groupId, sceneId);
            if (sceneEntry === undefined) {
                return { status: StatusCode.NotFound, groupId, sceneId };
            }
            const { sceneName, sceneTransitionTime, transitionTime100ms, extensionFieldSets } = sceneEntry;
            return {
                status: StatusCode.Success,
                groupId,
                sceneId,
                sceneName,
                transitionTime: sceneTransitionTime * 10 + transitionTime100ms,
                extensionFieldSets
            };
        },

        copyScene: async ({ request: { mode, groupIdFrom, sceneIdFrom, groupIdTo, sceneIdTo }, session, message: { packetHeader: { sessionType } }, endpoint }) => {
            if (sessionType !== SessionType.Unicast) {
                throw new Error("Groupcast not supported");
                // TODO: When Unicast we generate a response, else not
            }

            const fabric = (session as SecureSession<MatterDevice>).getAccessingFabric();

            if (groupIdFrom.id !== 0 && !GroupsManager.hasGroup(fabric, endpoint.getId(), groupIdFrom)) {
                return { status: StatusCode.InvalidCommand, groupIdFrom, sceneIdFrom };
            }
            if (groupIdTo.id !== 0 && !GroupsManager.hasGroup(fabric, endpoint.getId(), groupIdTo)) {
                return { status: StatusCode.InvalidCommand, groupIdFrom, sceneIdFrom };
            }

            if (mode.copyAllScenes) {
                // All scenes of group are copied. Ignore sceneIdFrom and sceneIdTo
                const sceneEntries = ScenesManager.getAllScenes(fabric, endpoint.getId(), groupIdFrom);
                const newSceneEntries = sceneEntries.map(({ sceneId, sceneName, sceneTransitionTime, extensionFieldSets, transitionTime100ms }) => ({
                    scenesGroupId: groupIdTo.id,
                    sceneId,
                    sceneName,
                    sceneTransitionTime,
                    extensionFieldSets,
                    transitionTime100ms
                }));
                ScenesManager.setScenes(fabric, endpoint.getId(), newSceneEntries);
            } else {
                const sceneEntryFrom = ScenesManager.getSceneEntry(fabric, endpoint.getId(), groupIdFrom, sceneIdFrom);
                if (sceneEntryFrom === undefined) {
                    return { status: StatusCode.NotFound, groupIdFrom, sceneIdFrom };
                }
                const { sceneName, sceneTransitionTime, transitionTime100ms, extensionFieldSets } = sceneEntryFrom;
                ScenesManager.setScenes(fabric, endpoint.getId(), [{
                    scenesGroupId: groupIdTo.id,
                    sceneId: sceneIdTo,
                    sceneName,
                    sceneTransitionTime,
                    extensionFieldSets,
                    transitionTime100ms
                }]);
            }

            return { status: StatusCode.Success, groupIdFrom, sceneIdFrom };
        },

        getSceneValid: ({ session, attributes: { currentScene, currentGroup }, endpoint }) => {
            if (session === undefined || endpoint === undefined) {
                console.log("getSceneValid: session or endpoint undefined");
                return false;
            }
            const fabric = (session as SecureSession<MatterDevice>).getAccessingFabric();

            const existingSceneEntry = ScenesManager.getSceneEntry(fabric, endpoint.getId(), currentGroup.get(), currentScene.get());
            if (existingSceneEntry === undefined) {
                console.log(`getSceneValid: existingSceneEntry undefined for ${endpoint.id}/${currentGroup.get().id}/${currentScene.get()}`);
                return false;
            }

            for (const clusterData of existingSceneEntry.extensionFieldSets) {
                const { clusterId, attributeValueList } = clusterData;
                const cluster = endpoint.getClusterServerById(clusterId.id);
                if (cluster !== undefined) {
                    if (!cluster._verifySceneExtensionFieldSets(attributeValueList)) {
                        return false;
                    }
                }
            }
            return true;
        },

        getSceneCount: ({ session, endpoint }) => {
            if (session === undefined || endpoint === undefined) {
                console.log("getSceneCount: session or endpoint undefined");
                throw new Error("getSceneCount: session or endpoint undefined");
            }

            const fabric = (session as SecureSession<MatterDevice>).getAccessingFabric();
            const endpointScenes = ScenesManager.getEndpointScenes(fabric, endpoint.getId());
            if (endpointScenes === undefined) return 0;
            let sceneCount = 0;
            for (const [_groupId, scenes] of endpointScenes) {
                sceneCount += scenes.size;
            }
            return sceneCount;
        }
    }
};

export const createDefaultScenesClusterServer = () => ClusterServer(
    ScenesCluster,
    {
        sceneCount: 0,
        currentScene: 0,
        currentGroup: new GroupId(0),
        sceneValid: false,
        nameSupport: {
            sceneNames: true,
        },
        lastConfiguredBy: null,
    },
    ScenesClusterHandler()
);
