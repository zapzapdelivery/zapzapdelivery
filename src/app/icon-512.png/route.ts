import React from 'react';
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export function GET() {
  return new ImageResponse(
    React.createElement(
      'div',
      {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#10b981',
          color: '#ffffff',
          fontSize: 196,
          fontWeight: 900,
          letterSpacing: -6
        }
      },
      'ZZ'
    ),
    {
      width: 512,
      height: 512
    }
  );
}
