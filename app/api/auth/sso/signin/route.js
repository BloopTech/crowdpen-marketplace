import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import sequelize from '../../../../models/database';
import crypto from 'crypto';
import {db} from "../../../../models";

const {User} = db;

export async function POST(request) {
  const cookieStore = await cookies();

  try {
    const { userData, callbackUrl } = await request.json();
    
    console.log('=== SSO DIRECT SIGNIN START ===');
    console.log('User data provided:', !!userData);
    console.log('Callback URL:', callbackUrl);
    
    if (!userData) {
      return NextResponse.json({ error: 'No user data provided' }, { status: 400 });
    }
    
    // Parse user data
    let parsedUserData;
    try {
      parsedUserData = typeof userData === 'string' ? JSON.parse(userData) : userData;
    } catch (error) {
      console.error('Failed to parse user data:', error);
      return NextResponse.json({ error: 'Invalid user data format' }, { status: 400 });
    }
    
    if (!parsedUserData.email || !parsedUserData.id) {
      return NextResponse.json({ error: 'Missing required user data' }, { status: 400 });
    }
    
    console.log('Creating database session for user:', parsedUserData.email);
    
    // Find or create user in database
    const dbUser = await User.findOne({
      where: { email: parsedUserData.email.toLowerCase() },
      defaults: {
        id: parsedUserData.id,
        email: parsedUserData.email,
        name: parsedUserData.name,
        image: parsedUserData.image,
      }
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }
    
    console.log('Database user found/created:', dbUser.id);
    
    // Create database session
    const sessionToken = crypto.randomUUID();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    
    const session = await sequelize.models.Session.create({
      session_token: sessionToken,
      user_id: dbUser.id,
      expires: expires,
    });
    
    console.log('Database session created with token:', session);
    
    // Set session cookie
    
    cookieStore.set('next-auth.session-token', sessionToken, {
      expires: expires,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    
    console.log('Session cookie set successfully');
    console.log('=== SSO DIRECT SIGNIN SUCCESS ===');
    
    return NextResponse.json({ 
      success: true, 
      redirectUrl: callbackUrl || '/',
      sessionToken: sessionToken 
    });
    
  } catch (error) {
    console.error('SSO direct signin error:', error);
    return NextResponse.json({ 
      error: 'Failed to create session',
      details: error.message 
    }, { status: 500 });
  }
}
