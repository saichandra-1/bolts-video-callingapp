import React, { useState } from 'react';
import VideoChat from './components/VideoChat';
import JoinRoom from './components/JoinRoom';
import { Video, VideoOff, Phone, PhoneOff, Mic, MicOff } from 'lucide-react';

function App() {
  const [username, setUsername] = useState<string>('');
  const [joined, setJoined] = useState<boolean>(false);

  const handleJoin = (name: string) => {
    setUsername(name);
    setJoined(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-800 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden">
        <header className="bg-indigo-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Video className="h-6 w-6" />
              <h1 className="text-xl font-bold">WebRTC Video Chat</h1>
            </div>
            {joined && (
              <div className="text-sm bg-indigo-700 px-3 py-1 rounded-full">
                Logged in as: {username}
              </div>
            )}
          </div>
        </header>
        
        <main className="p-4">
          {!joined ? (
            <JoinRoom onJoin={handleJoin} />
          ) : (
            <VideoChat username={username} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;