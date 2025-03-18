"use client";
import { io } from "socket.io-client";

export const socket = io("socketio-videocall-server-production.up.railway.app"); 

// socketio-videocall-server-production.up.railway.app