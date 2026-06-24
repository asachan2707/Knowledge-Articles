import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { ProductsPage } from './pages/ProductsPage.jsx';
import { LaunchPage }   from './pages/LaunchPage.jsx';
import { AdminPage }    from './pages/AdminPage.jsx';
import { SocketProvider } from './components/SocketProvider.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"                element={<ProductsPage />} />
          <Route path="/product/:id"     element={<LaunchPage   />} />
          <Route path="/admin"           element={<AdminPage    />} />
          <Route path="/admin/:id"       element={<AdminPage    />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  </React.StrictMode>
);
