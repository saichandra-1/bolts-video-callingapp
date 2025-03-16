import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Video, VideoOff, Phone, PhoneOff, Mic, MicOff, UserPlus } from 'lucide-react';

interface VideoChatProps {
  username: string;
}

interface User {
  id: string;
  username: string;
}

const VideoChat: React.FC<VideoChatProps> = ({ username }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [callTo, setCallTo] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [callActive, setCallActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  // Initialize socket connection
  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);
    
    return () => {
      newSocket.disconnect();
    };
  }, []);
  
  // Join room when socket is ready
  useEffect(() => {
    if (socket) {
      socket.emit('join', username);
      
      // Listen for active users updates
      socket.on('activeUsers', (users: User[]) => {
        // Filter out current user
        setActiveUsers(users.filter(user => user.id !== socket.id));
      });
      
      // Listen for incoming calls
      socket.on('callIncoming', (data) => {
        setIncomingCall(data);
      });
      
      // Listen for call acceptance
      socket.on('callAccepted', (signal) => {
        handleCallAccepted(signal);
      });
      
      // Listen for ICE candidates
      socket.on('ice-candidate', ({ candidate }) => {
        if (peerConnectionRef.current) {
          peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });
      
      // Listen for call end
      socket.on('callEnded', () => {
        endCall();
      });
    }
    
    return () => {
      if (socket) {
        socket.off('activeUsers');
        socket.off('callIncoming');
        socket.off('callAccepted');
        socket.off('ice-candidate');
        socket.off('callEnded');
      }
    };
  }, [socket, username]);
  
  // Initialize local media stream
  useEffect(() => {
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        
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
  
  const createPeerConnection = () => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
    
    const pc = new RTCPeerConnection(configuration);
    
    // Add local tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket && callTo) {
        socket.emit('ice-candidate', {
          target: callTo,
          candidate: event.candidate
        });
      }
    };
    
    // Handle receiving remote stream
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
    
    peerConnectionRef.current = pc;
    return pc;
  };
  
  const initiateCall = async (userId: string) => {
    if (!socket) return;
    
    setCallTo(userId);
    const pc = createPeerConnection();
    
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socket.emit('callUser', {
        userToCall: userId,
        signalData: offer,
        from: socket.id,
        name: username
      });
    } catch (err) {
      console.error('Error creating offer:', err);
    }
  };
  
  const answerCall = async () => {
    if (!socket || !incomingCall) return;
    
    setCallTo(incomingCall.from);
    setCallActive(true);
    
    const pc = createPeerConnection();
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.signal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socket.emit('answerCall', {
        signal: answer,
        to: incomingCall.from
      });
      
      setIncomingCall(null);
    } catch (err) {
      console.error('Error answering call:', err);
    }
  };
  
  const handleCallAccepted = async (signal: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) return;
    
    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
      setCallActive(true);
    } catch (err) {
      console.error('Error handling accepted call:', err);
    }
  };
  
  const endCall = () => {
    if (socket && callTo) {
      socket.emit('endCall', { to: callTo });
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    setCallActive(false);
    setCallTo(null);
    setIncomingCall(null);
  };
  
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };
  
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Video area */}
      <div className={`flex ${callActive ? 'flex-row' : 'justify-center'} gap-4 mb-4`}>
        {/* Local video */}
        <div className={`relative ${callActive ? 'w-1/3' : 'w-2/3'}`}>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-auto rounded-lg bg-gray-900 shadow-md"
          />
          <div className="absolute bottom-2 left-2 bg-gray-800 bg-opacity-70 text-white px-2 py-1 rounded text-sm">
            You
          </div>
        </div>
        
        {/* Remote video (only shown when in a call) */}
        {callActive && (
          <div className="relative w-2/3">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-auto rounded-lg bg-gray-900 shadow-md"
            />
            <div className="absolute bottom-2 left-2 bg-gray-800 bg-opacity-70 text-white px-2 py-1 rounded text-sm">
              {activeUsers.find(user => user.id === callTo)?.username || 'Remote User'}
            </div>
          </div>
        )}
      </div>
      
      {/* Call controls */}
      <div className="flex justify-center space-x-4 mb-6">
        <button
          onClick={toggleMute}
          className={`p-3 rounded-full ${isMuted ? 'bg-red-500' : 'bg-gray-200'}`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="h-6 w-6 text-white" /> : <Mic className="h-6 w-6" />}
        </button>
        
        {callActive && (
          <button
            onClick={endCall}
            className="p-3 rounded-full bg-red-500"
            title="End Call"
          >
            <PhoneOff className="h-6 w-6 text-white" />
          </button>
        )}
        
        <button
          onClick={toggleVideo}
          className={`p-3 rounded-full ${isVideoOff ? 'bg-red-500' : 'bg-gray-200'}`}
          title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isVideoOff ? <VideoOff className="h-6 w-6 text-white" /> : <Video className="h-6 w-6" />}
        </button>
      </div>
      
      {/* Incoming call notification */}
      {incomingCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Incoming Call</h3>
            <p className="mb-6">{incomingCall.name} is calling you</p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setIncomingCall(null)}
                className="px-4 py-2 bg-gray-300 rounded-lg"
              >
                Decline
              </button>
              <button
                onClick={answerCall}
                className="px-4 py-2 bg-green-500 text-white rounded-lg flex items-center"
              >
                <Phone className="mr-2 h-5 w-5" />
                Answer
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* User list */}
      {!callActive && (
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-2">Available Users</h3>
          {activeUsers.length === 0 ? (
            <p className="text-gray-500">No other users online</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {activeUsers.map((user) => (
                <li key={user.id} className="py-3 flex justify-between items-center">
                  <span>{user.username}</span>
                  <button
                    onClick={() => initiateCall(user.id)}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg flex items-center"
                  >
                    <Phone className="mr-1 h-4 w-4" />
                    Call
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoChat;