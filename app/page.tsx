'use client';

import { useState, useEffect } from 'react';
import ChatInterface from '@/components/ChatInterface';
import GoogleDriveTest from '@/components/GoogleDriveTest';
import DocumentBrowser from '@/components/DocumentBrowser';
import ProjectDevelopment from '@/components/ProjectDevelopment';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'chat' | 'browser' | 'project'>('chat');
  useEffect(() => {
    console.log('✅ Home component mounted successfully!', 'activeTab:', activeTab);
    console.log('✅ React is working, event handlers should be functional');
    
    // Test if we can add event listeners
    const testClick = () => console.log('✅ Click events are working!');
    document.addEventListener('click', testClick, { once: true });
    
    return () => {
      document.removeEventListener('click', testClick);
    };
  }, [activeTab]);

  return (
    <main className="min-h-screen bg-white" style={{ pointerEvents: 'auto' }}>
      <div className="container mx-auto px-4 py-8 lg:py-12">
        <header className="mb-10 text-center relative">
          <h1 className="text-5xl font-extrabold text-black mb-3">
            Telephony Advisor
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Telephony Advisor and Project Analysis Tool, Powered by AI
          </p>
        </header>

        <div className="max-w-7xl mx-auto">
          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-2 mb-8 bg-white rounded-2xl shadow-lg p-2 border-2 border-black">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Chat tab clicked');
                setActiveTab('chat');
              }}
              className={`flex-1 min-w-[140px] py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                activeTab === 'chat'
                  ? 'bg-black text-white shadow-lg transform scale-105'
                  : 'text-black hover:bg-gray-100 border border-gray-300'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Telephony Advisor
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Browser tab clicked');
                setActiveTab('browser');
              }}
              className={`flex-1 min-w-[140px] py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                activeTab === 'browser'
                  ? 'bg-black text-white shadow-lg transform scale-105'
                  : 'text-black hover:bg-gray-100 border border-gray-300'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Vector DB Browser
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Project Development tab clicked');
                setActiveTab('project');
              }}
              className={`flex-1 min-w-[140px] py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                activeTab === 'project'
                  ? 'bg-black text-white shadow-lg transform scale-105'
                  : 'text-black hover:bg-gray-100 border border-gray-300'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Project Development
              </span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-2xl shadow-2xl p-6 lg:p-8 border-2 border-black">
            {activeTab === 'chat' ? (
              <ChatInterface />
            ) : activeTab === 'browser' ? (
              <DocumentBrowser />
            ) : activeTab === 'project' ? (
              <ProjectDevelopment />
            ) : (
              <ChatInterface />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

