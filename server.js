const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 10000;

const wss = new WebSocketServer({
    port: PORT,
    host: '0.0.0.0'
});

const rooms = new Map();

console.log(`Signaling server running on port ${PORT}`);

wss.on('connection', (ws) => {

    let currentRoom = null;
    let userType = null;

    ws.on('message', (message) => {

        try {

            const data = JSON.parse(message);

            // =========================
            // JOIN ROOM
            // =========================

            if (data.type === 'join') {

                const roomId = data.room;

                if (!roomId) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Missing room ID'
                    }));
                    return;
                }

                // CREATE ROOM
                if (!rooms.has(roomId)) {

                    rooms.set(roomId, {
                        host: ws,
                        guest: null
                    });

                    currentRoom = roomId;
                    userType = 'host';

                    ws.send(JSON.stringify({
                        type: 'joined',
                        role: 'host',
                        room: roomId
                    }));

                    console.log(
                        `Room created: ${roomId}`
                    );

                    return;
                }

                // JOIN EXISTING ROOM
                const room = rooms.get(roomId);

                if (room.guest === null) {

                    room.guest = ws;

                    currentRoom = roomId;
                    userType = 'guest';

                    ws.send(JSON.stringify({
                        type: 'joined',
                        role: 'guest',
                        room: roomId
                    }));

                    // IMPORTANT:
                    // This is the message index.html expects.
                    room.host.send(JSON.stringify({
                        type: 'peer-joined'
                    }));

                    console.log(
                        `Guest joined room: ${roomId}`
                    );

                } else {

                    ws.send(JSON.stringify({
                        type: 'room-full'
                    }));

                    ws.close();
                }

                return;
            }

            // =========================
            // WEBRTC SIGNALING
            // =========================

            if (
                data.type === 'offer' ||
                data.type === 'answer' ||
                data.type === 'candidate'
            ) {

                if (
                    !currentRoom ||
                    !rooms.has(currentRoom)
                ) {
                    return;
                }

                const room =
                    rooms.get(currentRoom);

                const target =
                    userType === 'host'
                        ? room.guest
                        : room.host;

                if (
                    target &&
                    target.readyState === 1
                ) {

                    target.send(
                        JSON.stringify(data)
                    );
                }

                return;
            }

        } catch (error) {

            console.error(
                'Message error:',
                error
            );
        }

    });

    // =========================
    // DISCONNECT
    // =========================

    ws.on('close', () => {

        if (
            !currentRoom ||
            !rooms.has(currentRoom)
        ) {
            return;
        }

        const room =
            rooms.get(currentRoom);

        if (userType === 'host') {

            if (
                room.guest &&
                room.guest.readyState === 1
            ) {

                room.guest.send(
                    JSON.stringify({
                        type: 'peer-left'
                    })
                );
            }

            rooms.delete(currentRoom);

        } else if (userType === 'guest') {

            if (
                room.host &&
                room.host.readyState === 1
            ) {

                room.host.send(
                    JSON.stringify({
                        type: 'peer-left'
                    })
                );
            }

            room.guest = null;
        }

        console.log(
            `User left room: ${currentRoom}`
        );
    });

});
