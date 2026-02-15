import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- SVG Fingerprint Icon ---
const FingerprintIcon = ({ size = 80 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4" />
        <path d="M5 19.5C5.5 18 6 15 6 12c0-3.5 2.5-6 6-6a6 6 0 0 1 4.8 2.4" />
        <path d="M9 12c0-1.7 1.3-3 3-3a3 3 0 0 1 3 3v1" />
        <path d="M12 12v4c0 2.5-.5 4-2 5.5" />
        <path d="M8.5 16.5c-.3 1.5-.5 3-1 4.5" />
        <path d="M15 13v2c0 3-1 5.5-3 7.5" />
        <path d="M18 12a9 9 0 0 0-1-4" />
        <path d="M18 12v1c0 4-1.5 7-4 9" />
        <path d="M22 16c-1 3-3.5 6-7 8" />
    </svg>
);

interface WelcomeScreenProps {
    onComplete: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onComplete }) => {
    const [scanning, setScanning] = useState(false);
    const [authenticated, setAuthenticated] = useState(false);
    const [exiting, setExiting] = useState(false);

    const handleFingerprintClick = () => {
        if (scanning) return;
        setScanning(true);

        // After ripple plays, show "AUTHENTICATED"
        setTimeout(() => {
            setAuthenticated(true);
        }, 1200);

        // After confirmation, begin exit
        setTimeout(() => {
            setExiting(true);
        }, 2000);

        // After exit animation, remove welcome screen
        setTimeout(() => {
            onComplete();
        }, 2800);
    };

    return (
        <motion.div
            className="welcome-screen"
            initial={{ opacity: 1 }}
            animate={exiting ? { opacity: 0, scale: 1.1 } : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'radial-gradient(ellipse at center, #0a1628 0%, #050505 60%, #000000 100%)',
                overflow: 'hidden',
                cursor: 'default',
            }}
        >
            {/* Animated grid background */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.04,
                    backgroundImage: 'linear-gradient(#00f0ff 1px, transparent 1px), linear-gradient(90deg, #00f0ff 1px, transparent 1px)',
                    backgroundSize: '50px 50px',
                    pointerEvents: 'none',
                }}
            />

            {/* Scanning line */}
            <div className="welcome-scanline" />

            {/* Logo */}
            <motion.div
                initial={{ opacity: 0, scale: 0.3, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                style={{ textAlign: 'center', position: 'relative', zIndex: 2 }}
            >
                <h1
                    style={{
                        fontSize: 'clamp(3rem, 8vw, 6rem)',
                        fontWeight: 900,
                        letterSpacing: '-0.03em',
                        color: '#fff',
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                        margin: 0,
                        lineHeight: 1,
                        textShadow: '0 0 40px rgba(0, 240, 255, 0.3), 0 0 80px rgba(0, 240, 255, 0.1)',
                    }}
                >
                    AEGIS
                </h1>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8, duration: 0.6 }}
                    style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                        fontSize: '0.85rem',
                        letterSpacing: '0.3em',
                        color: '#00f0ff',
                        textTransform: 'uppercase',
                        marginTop: '0.75rem',
                        opacity: 0.7,
                    }}
                >
                    Paramedic Dashboard
                </motion.div>
            </motion.div>

            {/* Mission Statement */}
            <div style={{ marginTop: '3rem', textAlign: 'center', position: 'relative', zIndex: 2 }}>
                {['FASTER RESPONSE', 'SMARTER SUPPORT', 'SAFER LIVES'].map((text, i) => (
                    <motion.div
                        key={text}
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.4 + i * 0.3, duration: 0.6, ease: 'easeOut' }}
                        style={{
                            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                            fontSize: 'clamp(0.85rem, 2vw, 1.1rem)',
                            letterSpacing: '0.25em',
                            color: i === 2 ? '#00f0ff' : 'rgba(255,255,255,0.6)',
                            fontWeight: i === 2 ? 700 : 400,
                            marginBottom: '0.6rem',
                            textTransform: 'uppercase',
                            textShadow: i === 2 ? '0 0 20px rgba(0, 240, 255, 0.4)' : 'none',
                        }}
                    >
                        {text === 'FASTER RESPONSE' && '▸ '}
                        {text === 'SMARTER SUPPORT' && '▸ '}
                        {text === 'SAFER LIVES' && '▸ '}
                        {text}
                    </motion.div>
                ))}
            </div>

            {/* Fingerprint Section */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.6, duration: 0.8 }}
                style={{
                    marginTop: '4rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative',
                    zIndex: 2,
                    cursor: 'pointer',
                }}
                onClick={handleFingerprintClick}
            >
                {/* Ripple rings on scan */}
                <AnimatePresence>
                    {scanning && !authenticated && (
                        <>
                            {[0, 1, 2, 3].map((ring) => (
                                <motion.div
                                    key={`ripple-${ring}`}
                                    initial={{ scale: 0.5, opacity: 0.8 }}
                                    animate={{ scale: 3 + ring * 0.5, opacity: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{
                                        duration: 1.5,
                                        delay: ring * 0.2,
                                        ease: 'easeOut',
                                    }}
                                    style={{
                                        position: 'absolute',
                                        width: 80,
                                        height: 80,
                                        borderRadius: '50%',
                                        border: '2px solid #00f0ff',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        pointerEvents: 'none',
                                    }}
                                />
                            ))}
                        </>
                    )}
                </AnimatePresence>

                {/* Authenticated flash */}
                <AnimatePresence>
                    {authenticated && !exiting && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            style={{
                                position: 'absolute',
                                top: -45,
                                width: 200,
                                textAlign: 'center',
                                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                                fontSize: '0.7rem',
                                letterSpacing: '0.3em',
                                color: '#22c55e',
                                fontWeight: 700,
                                textShadow: '0 0 15px rgba(34, 197, 94, 0.6)',
                            }}
                        >
                            ✓ IDENTITY VERIFIED
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Fingerprint icon button */}
                <div
                    className={`welcome-fingerprint ${scanning ? 'welcome-fingerprint-scanning' : ''} ${authenticated ? 'welcome-fingerprint-authenticated' : ''}`}
                    style={{
                        width: 100,
                        height: 100,
                        borderRadius: '50%',
                        border: `2px solid ${authenticated ? '#22c55e' : '#00f0ff'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: authenticated ? '#22c55e' : '#00f0ff',
                        transition: 'all 0.4s ease',
                        background: authenticated
                            ? 'rgba(34, 197, 94, 0.1)'
                            : scanning
                                ? 'rgba(0, 240, 255, 0.15)'
                                : 'rgba(0, 240, 255, 0.05)',
                    }}
                >
                    <FingerprintIcon size={50} />
                </div>

                {/* Label */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 3.0, duration: 0.5 }}
                    style={{
                        marginTop: '1rem',
                        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                        fontSize: '0.65rem',
                        letterSpacing: '0.35em',
                        color: authenticated ? '#22c55e' : 'rgba(255,255,255,0.4)',
                        textTransform: 'uppercase',
                        transition: 'color 0.4s ease',
                    }}
                >
                    {authenticated ? 'ACCESS GRANTED' : 'AUTHENTICATE TO CONTINUE'}
                </motion.div>
            </motion.div>

            {/* Bottom decorative line */}
            <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 2.2, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                style={{
                    position: 'absolute',
                    bottom: '2rem',
                    width: '60%',
                    height: 1,
                    background: 'linear-gradient(90deg, transparent, rgba(0,240,255,0.3), transparent)',
                    transformOrigin: 'center',
                    zIndex: 2,
                }}
            />

            {/* Full-screen flash on authentication */}
            <AnimatePresence>
                {exiting && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.3, 0] }}
                        transition={{ duration: 0.6 }}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'radial-gradient(circle, rgba(0,240,255,0.4) 0%, transparent 70%)',
                            zIndex: 10,
                            pointerEvents: 'none',
                        }}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default WelcomeScreen;
