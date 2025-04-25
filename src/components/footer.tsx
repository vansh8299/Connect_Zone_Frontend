"use client";

import Link from 'next/link';
import { FaCompass, FaChartLine, FaUser, FaStaylinked, FaCircle, FaSnapchat, FaPhone, FaFacebookMessenger } from 'react-icons/fa'; 
import { useEffect, useState } from 'react';
import { getCookie } from 'cookies-next';

const Footer = () => {
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    // Check for token when component mounts
    const token = getCookie('token');
    setHasToken(!!token);
  }, []);

  if (!hasToken) {
    return (
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 py-6 text-center">
        <p className="text-xl font-bold text-indigo-600">Powered by Connect_Zone</p>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200">
      <div className="flex justify-around py-3">
        {/* Chats Button */}
        <Link href="/">
          <button className="flex flex-col items-center text-gray-600 hover:text-green-600 transition-colors">
            <span className="w-6 h-6 mb-1">
              <FaFacebookMessenger />
            </span>
            <span className="text-xs">Chats</span>
          </button>
        </Link>

        {/* Status Button */}
        <Link href="/pages/portfolio">
          <button className="flex flex-col items-center text-gray-600 hover:text-green-500 transition-colors">
            <span className="w-6 h-6 mb-1">
              <FaCircle />
            </span>
            <span className="text-xs">Status</span>
          </button>
        </Link>

        {/* Calls Button */}
        <Link href="/pages/profile">
          <button className="flex flex-col items-center text-gray-600 hover:text-green-600 transition-colors">
            <span className="w-6 h-6 mb-1">
              <FaPhone />
            </span>
            <span className="text-xs">Calls</span>
          </button>
        </Link>

        {/* Profile Button */}
        <Link href="/pages/profile">
          <button className="flex flex-col items-center text-gray-600 hover:text-green-600 transition-colors">
            <span className="w-6 h-6 mb-1">
              <FaUser />
            </span>
            <span className="text-xs">Profile</span>
          </button>
        </Link>
      </div>
    </nav>
  );
};

export default Footer;