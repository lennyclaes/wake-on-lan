import { Buffer } from 'node:buffer';
import { Socket, createSocket } from 'node:dgram';
import { networkTools } from '@lennyclaes/network-tools';

/**
 * Creates the magic packet based on the MAC address and returns it as a buffer
 * @param mac The MAC address from which the magic packet is formed
 * @returns magicPacketBuffer
 */
function createMagicPacket(mac: string): Buffer {
    const macRepeats: number = 16;
    const macBufferSize: number = 6;
    const packetHeader: number = 6;

    // Create the buffer and fill first 6 bytes with FF
    let magicPacketBuffer = Buffer.alloc(packetHeader);
    magicPacketBuffer.fill(0xff);

    // Split the MAC address in segments, convert them to a buffer and concate this buffer 16 times with the magicPacketBuffer
    const segments: RegExpMatchArray | null = mac.match(/[0-9a-fA-F]{2}/g);
    if (!segments || segments.length != macBufferSize) {
        throw new Error(`invalid MAC-address ${mac}`);
    }
    const parsedSegments: number[] = segments.map((seg: string) => parseInt(seg, 16));
    const bufferedMac: Buffer = Buffer.from(parsedSegments);
    for (let i = 0; i < macRepeats; i++) {
        magicPacketBuffer = Buffer.concat([magicPacketBuffer, bufferedMac]);
    }

    return magicPacketBuffer;
}

function broadcastWakeMessage(magicPacket: Buffer, retries: number, broadcastAddress: string): void {
    // Later version: add support for ipv6
    const socket: Socket = createSocket('udp4');
    socket
        .on('error', (err: Error) => {
            throw new Error('Failed to create UDP socket:' + err);
        })
        .once('listening', () => {
            socket.setBroadcast(true);
        });
    let attempts = 1;
    const sendInterval: NodeJS.Timer = setInterval(() => {
        socket.send(magicPacket, 0, magicPacket.length, 9, broadcastAddress, (err: Error | null) => {
            if (err) {
                throw new Error(`Failed to broadcast wake: ${err.stack}`);
            }
            if (attempts >= retries) {
                console.log("sent to:", broadcastAddress);
                socket.close();
                clearInterval(sendInterval);
            }
            attempts++;
        });
    }, 350);
}

/**
 * Broadcasts the Wake-On-Lan message to the specified MAC address
 * @param mac The MAC address for which the broadcast is meant.
 * @param retries The amount of times the broadcast should be sent. Defaults to 1
 * @param broadcastAddress The broadcast address on which the request is sent. When empty it sends to all broadcast addresses on the connected networks
 */
function sendWake(mac: string, retries: number = 1, broadcastAddress?: string): void {
    let magicPacket: Buffer;
    try {
        magicPacket = createMagicPacket(mac);
    } catch (err: any) {
        throw new Error(`Failed to broadcast wake: ${err.message}`);
    }

    if (broadcastAddress) {
        broadcastWakeMessage(magicPacket, retries, broadcastAddress);
    } else {
        networkTools().then((data: any) => {
            for (let i = 0; i < data.length; i++) {
                broadcastWakeMessage(magicPacket, retries, data[i].broadcast);
            }
        });
    }
}

export default sendWake;