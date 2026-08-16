// Awtomatikong mag-i-install ng ws module kapag tumakbo sa Render
try {
    require('ws');
} catch (e) {
    console.log("Installing ws module dynamically...");
    require('child_process').execSync('npm install ws');
}

const { WebSocketServer } = require('ws');

// Gagamit ng port ng Render at magbi-bind sa 0.0.0.0 para maiwasan ang Port Timeout
const PORT = process.env.PORT || 10000;
const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });

const rooms = new Map();

console.log(`Signaling server ay tumatakbo sa port ${PORT}`);

wss.on('connection', (ws) => {
    let currentRoom = null;
    let userType = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'join') {
                const roomId = data.room;
                
                if (!rooms.has(roomId)) {
                    rooms.set(roomId, { host: ws, guest: null });
                    currentRoom = roomId;
                    userType = 'host';
                    ws.send(JSON.stringify({ type: 'joined', role: 'host', room: roomId }));
                    console.log(`Room ${roomId} ginawa ng Host.`);
                } else {
                    const room = rooms.get(roomId);
                    if (room.guest === null) {
                        room.guest = ws;
                        currentRoom = roomId;
                        userType = 'guest';
                        ws.send(JSON.stringify({ type: 'joined', role: 'guest', room: roomId }));
                        room.host.send(JSON.stringify({ type: 'user-connected' }));
                        console.log(`User B pumasok sa Room ${roomId}.`);
                    } else {
                        ws.send(JSON.stringify({ type: 'full', message: 'Puno na ang room.' }));
                        ws.close();
                    }
                }
            }

            if (data.type === 'offer' || data.type === 'answer' || data.type === 'candidate') {
                if (currentRoom && rooms.has(currentRoom)) {
                    const room = rooms.get(currentRoom);
                    const target = (userType === 'host') ? room.guest : room.host;
                    if (target) {
                        target.send(JSON.stringify(data));
                    }
                }
            }

        } catch (e) {
            console.error("Error sa mensahe:", e);
        }
    });

    ws.on('close', () => {
        if (currentRoom && rooms.has(currentRoom)) {
            const room = rooms.get(currentRoom);
            if (userType === 'host') {
                if (room.guest) room.guest.send(JSON.stringify({ type: 'user-disconnected' }));
                rooms.delete(currentRoom);
            } else if (userType === 'guest') {
                if (room.host) room.host.send(JSON.stringify({ type: 'user-disconnected' }));
                room.guest = null;
            }
            console.log(`May umalis sa Room ${currentRoom}.`);
        }
    });
});
