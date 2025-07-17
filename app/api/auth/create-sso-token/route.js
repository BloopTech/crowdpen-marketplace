import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function POST(request) {
  try {
    const { user } = await request.json();
    
    if (!user || !user.email) {
      return NextResponse.json(
        { error: 'Invalid user data' },
        { status: 400 }
      );
    }
    
    // Create a JWT token with the user data
    const token = jwt.sign(
      {
        email: user.email,
        name: user.name,
        image: user.image,
        id: user.id,
      },
      process.env.NEXTAUTH_SECRET,
      { expiresIn: '1h' }
    );
    
    console.log('Created SSO token for:', user.email);
    
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error creating SSO token:', error);
    return NextResponse.json(
      { error: 'Failed to create token' },
      { status: 500 }
    );
  }
}
