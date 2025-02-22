'use client'

import { useState } from 'react';
import { Button } from "@/components/ui/button"

export default function main() {
  return (
    <div className='container mx-auto p-4'>
      <div className='space-y-4'>
        <div className='flex space-x-4'>
          <Button
          
          >
            Deposit
          </Button>
          <Button
            
          >
            Buy
          </Button>
          <Button
            
          >
            Get Position
          </Button>
          <Button
            
          >
            Get Collaterial
          </Button>
        </div>
      </div>
    </div>
  );
}