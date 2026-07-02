import React from 'react';
import './Hero.css';

function Hero({ searchTerm, onSearch }) {
    return (
        <section className="hero">
            <div className="container">
                <h1>डॉक्टर की उपलब्धता चेक करें</h1>
                <p>जानें कि आज आपके पसंदीदा डॉक्टर हॉस्पिटल में उपलब्ध हैं या नहीं</p>
                
                <div className="search-box">
                    <div className="search-input-wrapper">
                        <i className="fas fa-search"></i>
                        <input 
                            type="text" 
                            placeholder="डॉक्टर का नाम या हॉस्पिटल खोजें..."
                            value={searchTerm}
                            onChange={(e) => onSearch(e.target.value)}
                        />
                    </div>
                    <button className="btn btn-search">
                        <i className="fas fa-search"></i> खोजें
                    </button>
                </div>
            </div>
        </section>
    );
}

export default Hero;
