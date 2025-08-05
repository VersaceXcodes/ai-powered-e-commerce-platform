import React from 'react';
import { Link } from 'react-router-dom';

const UV_404: React.FC = () => {
  return (
    <>
      <section className="min-h-screen w-full flex flex-col justify-center items-center bg-white px-4 py-12">
        {/* Visual Illustration */}
        <img
          src="https://picsum.photos/seed/aiocart404/360/180"
          alt="Friendly robot illustration for 404"
          className="mb-8 w-72 h-44 rounded-md object-cover shadow-lg"
          draggable={false}
          aria-hidden="true"
        />
        {/* Page Header */}
        <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-4 text-center tracking-tight">
          404 – Page Not Found
        </h1>
        {/* Description */}
        <div
          className="mb-8 md:mb-12 text-lg text-gray-600 text-center max-w-2xl"
          aria-live="polite"
        >
          Oops! The page you&apos;re looking for doesn&apos;t exist or may have been moved.<br />
          If you entered a URL, please check it. Otherwise, let&apos;s help you get back on track!
        </div>
        {/* CTA Buttons */}
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="inline-block rounded-md bg-blue-600 text-white text-base font-semibold px-7 py-3 text-center hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-shadow duration-150"
            tabIndex={0}
            aria-label="Back to Home Page"
          >
            Return to Home
          </Link>
          <Link
            to="/products"
            className="inline-block rounded-md border border-gray-300 bg-white text-gray-700 text-base font-semibold px-7 py-3 text-center hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-shadow duration-150"
            tabIndex={0}
            aria-label="Browse Products"
          >
            Browse Products
          </Link>
        </div>
      </section>
    </>
  );
};

export default UV_404;