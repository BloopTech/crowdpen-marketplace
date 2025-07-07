"use client";
import React from 'react'
import { useSession } from 'next-auth/react';
import UnauthenticatedNavBar from './unauthenticated';
import AuthenticatedNavBar from './authenticated';

export default function OfficialNavbar() {
    const { status } = useSession();

    return (
        <div className='w-full'>
            {status === "authenticated" ? <AuthenticatedNavBar /> : <UnauthenticatedNavBar />}
        </div>
    )
}