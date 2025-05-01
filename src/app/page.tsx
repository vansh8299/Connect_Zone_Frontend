"use client";

import { motion } from 'framer-motion';
import { FaComments, FaUserFriends, FaLock, FaRocket } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { getCookie, getCookies } from 'cookies-next';

export default function HomePage() {
  const router = useRouter();
  const token = getCookie('token');

  const features = [
    {
      icon: <FaComments className="w-8 h-8 text-indigo-600" />,
      title: "Real-time Chat and Calling",
      description: "Experience seamless messaging, calling and video calling"
    },
    {
      icon: <FaUserFriends className="w-8 h-8 text-indigo-600" />,
      title: "Group Conversations",
      description: "Connect with multiple people in shared spaces"
    },
    {
      icon: <FaLock className="w-8 h-8 text-indigo-600" />,
      title: "End-to-End Encryption",
      description: "Your conversations stay private and secure"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      {/* Hero Section */}
      <div className="container mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="flex justify-center mb-6">
            <div className="bg-indigo-100 p-4 rounded-full">
              <FaRocket className="w-10 h-10 text-indigo-600" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            Connect with <span className="text-indigo-600">Everyone</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            A modern chat application that brings people together with secure, real-time messaging.
          </p>
          
          <div className="flex justify-center space-x-4">
            {token ? (
              <button
                onClick={() => router.push('/pages/chats')}
                className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-lg"
              >
                Go to Dashboard
              </button>
            ) : (
              <>
                <button
                  onClick={() => router.push('/pages/login')}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-lg"
                >
                  Sign In
                </button>
                <button
                  onClick={() => router.push('/pages/signup')}
                  className="px-8 py-3 bg-white text-indigo-600 border border-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition-colors shadow-lg"
                >
                  Join Now
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>

      {/* Features Section */}
      <div className="bg-white py-16">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
            Why Choose ConnectZone?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="bg-indigo-50 p-8 rounded-xl text-center"
              >
                <div className="flex justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-indigo-600 py-16 mb-28">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <h2 className="text-3xl font-bold text-white mb-6">
              Ready to start chatting?
            </h2>
            <p className="text-indigo-100 mb-8 max-w-2xl mx-auto">
              Join thousands of users who are already connecting with friends, family, and colleagues.
            </p>
            <button
              onClick={() => router.push(token ? '/dashboard' : '/signup')}
              className="px-8 py-3 bg-white text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition-colors shadow-lg"
            >
              {getCookie('token') ? 'Go to Chat' : 'Get Started for Free'}
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}