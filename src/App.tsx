import React, { useState } from 'react';
import JoinRoom from './components/JoinRoom';
import VideoChat from './components/VideoChat';

const Home: React.FC = () => {
  const [joined, setJoined] = useState<boolean>(false);
  const [roomData, setRoomData] = useState<{ username: string; roomId: string }>({
    username: '',
    roomId: '',
  });

  const handleJoin = (data: { username: string; roomId: string }) => {
    setRoomData(data);
    setJoined(true);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {joined ? (
        <VideoChat username={roomData.username} roomId={roomData.roomId} />
      ) : (
        <JoinRoom onJoin={handleJoin} />
      )}
    </div>
  );
};

export default Home;