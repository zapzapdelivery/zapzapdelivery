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
          fontSize: 72,
          fontWeight: 900,
          letterSpacing: -2
        }
      },
      'ZZ'
    ),
    {
      width: 180,
      height: 180
    }
  );
}
