
import React from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import ChatInterface from '@/components/ChatInterface';

const Chat = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <div className="pt-20 pb-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Chat con <span className="gradient-text">Opobot</span>
              </h1>
              <p className="text-gray-600">
                Tu asistente personal especializado en oposiciones al Estado español
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <ChatInterface />
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Chat;
