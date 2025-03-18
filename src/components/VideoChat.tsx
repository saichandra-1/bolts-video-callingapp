"use client";
import React, { useEffect, useRef, useState } from 'react';
import { socket } from '../lib/socket';
import { Video, VideoOff, Mic, MicOff, PhoneOff } from 'lucide-react';

interface VideoChatProps {
  username: string;
  roomId: string;
}

const VideoChat: React.FC<VideoChatProps> = ({ username, roomId }) => {
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  const [remoteUsers, setRemoteUsers] = useState<string[]>([]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRefs = useRef<Record<string, React.RefObject<HTMLVideoElement>>>({});
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  // Initialize local media stream
  useEffect(() => {
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        localStreamRef.current = stream;
      } catch (err) {
        console.error('Error accessing media devices:', err);
      }
    };
    getMedia();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Handle socket and WebRTC logic
  useEffect(() => {
    socket.connect();
    socket.emit('join-room', { roomId, username });

    const createPeerConnection = (userId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { roomId, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        if (!remoteVideoRefs.current[userId]) {
          remoteVideoRefs.current[userId] = React.createRef<HTMLVideoElement>();
        }
        const remoteVideo = remoteVideoRefs.current[userId].current;
        if (remoteVideo) {
          remoteVideo.srcObject = event.streams[0];
        }
      };

      peerConnections.current[userId] = pc;
      return pc;
    };

    socket.on('user-connected', async (userId: string) => {
      const pc = createPeerConnection(userId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', { roomId, offer });
      setRemoteUsers(prev => [...prev, userId]);
    });

    socket.on('current-users', (users: string[]) => {
      users.forEach(async (userId) => {
        const pc = createPeerConnection(userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { roomId, offer });
        setRemoteUsers(prev => [...prev, userId]);
      });
    });

    socket.on('offer', async ({ offer, from }: { offer: RTCSessionDescriptionInit; from: string }) => {
      if (!peerConnections.current[from]) {
        const pc = createPeerConnection(from);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { roomId, answer });
        setRemoteUsers(prev => [...prev, from]);
      }
    });

    socket.on('answer', ({ answer, from }: { answer: RTCSessionDescriptionInit; from: string }) => {
      const pc = peerConnections.current[from];
      if (pc) {
        pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('ice-candidate', ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      Object.values(peerConnections.current).forEach(pc => {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => console.error(err));
      });
    });

    socket.on('user-disconnected', (userId: string) => {
      if (peerConnections.current[userId]) {
        peerConnections.current[userId].close();
        delete peerConnections.current[userId];
        delete remoteVideoRefs.current[userId];
        setRemoteUsers(prev => prev.filter(id => id !== userId));
      }
    });

    return () => {
      socket.off('user-connected');
      socket.off('current-users');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-disconnected');
      socket.disconnect();
    };
  }, [roomId, username]);

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => (track.enabled = !track.enabled));
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => (track.enabled = !track.enabled));
      setIsVideoOff(!isVideoOff);
    }
  };

  const endCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    Object.values(peerConnections.current).forEach(pc => pc.close());
    socket.disconnect();
    window.location.reload(); // Reset the page
  };

  return (
    <div className="flex flex-col h-full p-4">
      <h1 className="text-2xl font-bold mb-4">Room: {roomId}</h1>
      <div className="flex flex-row gap-4 mb-4">
        <div className="relative w-1/2">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-auto rounded-lg bg-gray-900 shadow-md"
          />
          <div className="absolute bottom-2 left-2 bg-gray-800 bg-opacity-70 text-white px-2 py-1 rounded text-sm">
            {username}
          </div>
        </div>

        {remoteUsers.map(userId => (
          <div key={userId} className="relative w-1/2">
            <video
              ref={ref => {
                if (ref) remoteVideoRefs.current[userId] = { current: ref };
              }}
              autoPlay
              playsInline
              className="w-full h-auto rounded-lg bg-gray-900 shadow-md"
            />
            <div className="absolute bottom-2 left-2 bg-gray-800 bg-opacity-70 text-white px-2 py-1 rounded text-sm">
              Remote User
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center space-x-4">
        <button
          onClick={toggleMute}
          className={`p-3 rounded-full ${isMuted ? 'bg-red-500' : 'bg-gray-200'}`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="h-6 w-6 text-white" /> : <Mic className="h-6 w-6" />}
        </button>
        <button
          onClick={endCall}
          className="p-3 rounded-full bg-red-500"
          title="End Call"
        >
          <PhoneOff className="h-6 w-6 text-white" />
        </button>
        <button
          onClick={toggleVideo}
          className={`p-3 rounded-full ${isVideoOff ? 'bg-red-500' : 'bg-gray-200'}`}
          title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isVideoOff ? <VideoOff className="h-6 w-6 text-white" /> : <Video className="h-6 w-6" />}
        </button>
      </div>
    </div>
  );
};

export default VideoChat;