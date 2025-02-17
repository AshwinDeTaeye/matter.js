[@project-chip/matter-node.js](../README.md) / [Modules](../modules.md) / [exports/protocol](../modules/exports_protocol.md) / ChannelManager

# Class: ChannelManager

[exports/protocol](../modules/exports_protocol.md).ChannelManager

## Table of contents

### Constructors

- [constructor](exports_protocol.ChannelManager.md#constructor)

### Properties

- [channels](exports_protocol.ChannelManager.md#channels)
- [getChannelKey](exports_protocol.ChannelManager.md#getchannelkey)

### Methods

- [getChannel](exports_protocol.ChannelManager.md#getchannel)
- [getOrCreateChannel](exports_protocol.ChannelManager.md#getorcreatechannel)
- [removeChannel](exports_protocol.ChannelManager.md#removechannel)
- [setChannel](exports_protocol.ChannelManager.md#setchannel)

## Constructors

### constructor

• **new ChannelManager**()

## Properties

### channels

• `Private` `Readonly` **channels**: `any`

#### Defined in

packages/matter.js/dist/cjs/protocol/ChannelManager.d.ts:16

___

### getChannelKey

• `Private` **getChannelKey**: `any`

#### Defined in

packages/matter.js/dist/cjs/protocol/ChannelManager.d.ts:17

## Methods

### getChannel

▸ **getChannel**(`fabric`, `nodeId`): [`MessageChannel`](exports_protocol.MessageChannel.md)<`any`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `fabric` | [`Fabric`](exports_fabric.Fabric.md) |
| `nodeId` | [`NodeId`](exports_datatype.NodeId.md) |

#### Returns

[`MessageChannel`](exports_protocol.MessageChannel.md)<`any`\>

#### Defined in

packages/matter.js/dist/cjs/protocol/ChannelManager.d.ts:19

___

### getOrCreateChannel

▸ **getOrCreateChannel**(`byteArrayChannel`, `session`): [`MessageChannel`](exports_protocol.MessageChannel.md)<`any`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `byteArrayChannel` | [`Channel`](../interfaces/net.Channel.md)<`Uint8Array`\> |
| `session` | [`Session`](../interfaces/exports_session.Session.md)<`any`\> |

#### Returns

[`MessageChannel`](exports_protocol.MessageChannel.md)<`any`\>

#### Defined in

packages/matter.js/dist/cjs/protocol/ChannelManager.d.ts:21

___

### removeChannel

▸ **removeChannel**(`fabric`, `nodeId`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `fabric` | [`Fabric`](exports_fabric.Fabric.md) |
| `nodeId` | [`NodeId`](exports_datatype.NodeId.md) |

#### Returns

`void`

#### Defined in

packages/matter.js/dist/cjs/protocol/ChannelManager.d.ts:20

___

### setChannel

▸ **setChannel**(`fabric`, `nodeId`, `channel`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `fabric` | [`Fabric`](exports_fabric.Fabric.md) |
| `nodeId` | [`NodeId`](exports_datatype.NodeId.md) |
| `channel` | [`MessageChannel`](exports_protocol.MessageChannel.md)<`any`\> |

#### Returns

`void`

#### Defined in

packages/matter.js/dist/cjs/protocol/ChannelManager.d.ts:18
