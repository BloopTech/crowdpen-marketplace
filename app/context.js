"use client";
import React, { createContext, useContext, useState } from "react";


const HomeContext = createContext(null);

const HomeProvider = ({ children }) => {
    const [loginDialog, setLoginDialog] = useState(false);


    const openLoginDialog = () => {
        setLoginDialog(true);
    };

    const closeLoginDialog = () => {
        setLoginDialog(false);
    };
    
    return (
        <HomeContext.Provider value={{ loginDialog, openLoginDialog, closeLoginDialog }}>
            {children}
        </HomeContext.Provider>
    );
};

const useHome = () => {
    const context = useContext(HomeContext);
    if (!context) {
        throw new Error("useHome must be used within a HomeProvider");
    }
    return context;
};

export { HomeProvider, useHome };
