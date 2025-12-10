import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header'; 
import Footer from './Footer';
import Navbar from './Navbar';

export default function Layout() { 
    return (
        <div className="app-container">
            {/* Header는 Provider의 범위 내에 있습니다. */}
            <Header onLogoClick={() => window.location.href = '/'}/>
            <Navigation /> 

            <main className="main-content">
                <div className="content-wrapper">
                    <Outlet /> {/* 현재 라우트의 컴포넌트가 여기에 표시됨 */}
                </div>
            </main>
            
            <Footer />
        </div>
    );
}
