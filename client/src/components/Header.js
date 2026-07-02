import React from 'react';
import './Header.css';

function Header() {
    return (
        <header className="header">
            <div className="container">
                <div className="logo">
                    <i className="fas fa-hospital"></i>
                    <span>LiveHospital</span>
                </div>
                <nav className="nav">
                    <ul>
                        <li><a href="#" className="active">होम</a></li>
                        <li><a href="#hospitals">हॉस्पिटल</a></li>
                        <li><a href="#contact">संपर्क करें</a></li>
                    </ul>
                </nav>
                <div className="header-actions">
                    <button className="btn btn-outline">लॉगिन</button>
                    <button className="btn btn-primary">रजिस्टर</button>
                </div>
            </div>
        </header>
    );
}

export default Header;
