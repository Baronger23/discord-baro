// ✅ LAZY LOAD: Advanced File Upload Component wrapper
"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Lazy load the heavy file upload component with react-dropzone
const AdvancedFileUpload = dynamic(
  () => import('./advanced-file-upload').then(mod => ({ default: mod.AdvancedFileUpload })),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading File Uploader...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Loader2 className="h-12 w-12 mx-auto text-gray-400 mb-4 animate-spin" />
            <p className="text-sm text-gray-500">Preparing upload interface...</p>
          </div>
        </CardContent>
      </Card>
    )
  }
);

export default AdvancedFileUpload;
