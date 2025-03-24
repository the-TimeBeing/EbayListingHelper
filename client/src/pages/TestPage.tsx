import React from 'react';
import { Button } from '@/components/ui/button';

export default function TestPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-md">
      <h1 className="text-2xl font-bold text-center mb-6">Test Navigation</h1>
      
      <div className="flex flex-col gap-4">
        <a href="/direct-photos" className="w-full">
          <Button
            className="w-full py-6 mb-4 rounded-full bg-gradient-to-r from-[#e53238] to-[#0064d2] hover:opacity-90 text-white font-semibold text-lg"
          >
            Go to Direct Photo Upload
          </Button>
        </a>
        
        <a href="/draft-listings" className="w-full">
          <Button
            className="w-full py-6 mb-4 rounded-full bg-green-600 hover:bg-green-700 text-white font-semibold text-lg"
          >
            View Draft Listings
          </Button>
        </a>
        
        <a href="/api/auth/test-login-redirect" className="w-full">
          <Button
            className="w-full py-6 mb-4 rounded-full bg-gray-700 hover:bg-gray-800 text-white font-semibold text-lg"
          >
            Test Login Redirect
          </Button>
        </a>
      </div>
    </div>
  );
}