
import React from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import ChatInterface from '@/components/ChatInterface';

const Chat = () => {
  return (
    <ProtectedRoute>
      <div className="w-full min-h-screen bg-[#f7f7fb] flex flex-col">
        <ChatInterface />
      </div>
    </ProtectedRoute>
  );
};

export default Chat;
