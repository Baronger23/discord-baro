"use client";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import axios from "axios";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";

import {
    Form,
    FormControl,
    FormField,
    FormItem,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useModal } from "@/hooks/use-modal-store";
import { Input } from "@/components/ui/input";
import { X, FileIcon, Loader2, Upload, Image, Video, FileText, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const formSchema = z.object({
    fileUrls: z.array(z.string()).min(1, { message: "At least one file is required" }),
});

interface UploadedFile {
    fileUrl: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    status: 'uploading' | 'completed' | 'error';
    progress?: number;
    error?: string;
}

export const MessageFileModal = () => {
    const { isOpen, onClose, type, data } = useModal();
    const { apiUrl, query } = data;
    
    const isModalOpen = isOpen && type === "messageFile";
    const router = useRouter();
    
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const MAX_FILES = 5;
    
    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            fileUrls: []
        },
    });

    const handleClose = () => {
        form.reset();
        setUploadedFiles([]);
        setUploadProgress(0);
        onClose();
    };

    const getFileIcon = (fileType: string) => {
        if (fileType.startsWith('image/')) return <Image className="w-8 h-8 text-blue-500" />;
        if (fileType.startsWith('video/')) return <Video className="w-8 h-8 text-purple-500" />;
        if (fileType.startsWith('audio/')) return <FileText className="w-8 h-8 text-green-500" />;
        return <FileIcon className="w-8 h-8 text-zinc-500" />;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;

        // Check if adding these files would exceed the limit
        if (uploadedFiles.filter(f => f.status === 'completed').length + files.length > MAX_FILES) {
            alert(`Chỉ được upload tối đa ${MAX_FILES} files! Bạn đã có ${uploadedFiles.filter(f => f.status === 'completed').length} files.`);
            return;
        }

        // Check individual file sizes
        const oversizedFiles = files.filter(f => f.size > 50 * 1024 * 1024);
        if (oversizedFiles.length > 0) {
            alert(`Các file sau quá lớn (>50MB): ${oversizedFiles.map(f => f.name).join(', ')}`);
            return;
        }

        setUploading(true);
        
        // Add files to list with 'uploading' status
        const pendingFiles: UploadedFile[] = files.map(file => ({
            fileUrl: '',
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            status: 'uploading' as const,
            progress: 0,
        }));
        
        setUploadedFiles(prev => [...prev, ...pendingFiles]);
        
        try {
            // Upload files one by one with individual progress
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileIndex = uploadedFiles.length + i;
                
                console.log(`📁 Uploading file ${i + 1}/${files.length}:`, {
                    name: file.name,
                    type: file.type,
                    size: formatFileSize(file.size)
                });

                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('type', 'messageAttachment');

                    const response = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        console.error('❌ Upload API error:', errorData);
                        throw new Error(errorData.error || 'Upload failed');
                    }

                    const result = await response.json();
                    console.log(`✅ Upload success (${i + 1}/${files.length}):`, result);
                    
                    // Update file status to completed
                    setUploadedFiles(prev => {
                        const updated = [...prev];
                        updated[fileIndex] = {
                            ...updated[fileIndex],
                            fileUrl: result.fileUrl,
                            status: 'completed',
                            progress: 100,
                        };
                        return updated;
                    });

                } catch (error) {
                    console.error(`❌ Failed to upload ${file.name}:`, error);
                    
                    // Update file status to error
                    setUploadedFiles(prev => {
                        const updated = [...prev];
                        updated[fileIndex] = {
                            ...updated[fileIndex],
                            status: 'error',
                            error: error instanceof Error ? error.message : 'Upload failed',
                        };
                        return updated;
                    });
                }

                // Update overall progress
                setUploadProgress(((i + 1) / files.length) * 100);
            }
            
            // Update form value with only completed files
            const completedFiles = uploadedFiles.filter(f => f.status === 'completed' && f.fileUrl);
            form.setValue('fileUrls', completedFiles.map(f => f.fileUrl));
            
        } catch (error) {
            console.error('Upload error:', error);
        } finally {
            setUploading(false);
            setUploadProgress(0);
            // Reset input
            event.target.value = '';
        }
    };

    const handleRemoveFile = (index: number) => {
        const updatedFiles = uploadedFiles.filter((_, i) => i !== index);
        setUploadedFiles(updatedFiles);
        const completedFiles = updatedFiles.filter(f => f.status === 'completed' && f.fileUrl);
        form.setValue('fileUrls', completedFiles.map(f => f.fileUrl));
    };

    const handleRetryFile = async (index: number) => {
        const file = uploadedFiles[index];
        if (!file || file.status !== 'error') return;

        // Reset file status to uploading
        setUploadedFiles(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                status: 'uploading',
                progress: 0,
                error: undefined,
            };
            return updated;
        });

        try {
            alert('Retry functionality requires re-selecting the file. Please remove and re-upload.');
            
            setUploadedFiles(prev => {
                const updated = [...prev];
                updated[index] = {
                    ...updated[index],
                    status: 'error',
                    error: 'Please remove and re-upload the file',
                };
                return updated;
            });
            
        } catch (error) {
            console.error('Retry failed:', error);
        }
    };

    const isLoading = form.formState.isSubmitting;
    
    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            const url = apiUrl || "/api/socket/messages";

            // Send only completed files as separate messages
            const completedFiles = uploadedFiles.filter(f => f.status === 'completed' && f.fileUrl);
            
            for (const file of completedFiles) {
                const payload = {
                    content: `📎 ${file.fileName}`,
                    fileUrl: file.fileUrl,
                    ...query
                };

                await axios.post(url, payload);
            }
            
            form.reset();
            setUploadedFiles([]);
            router.refresh();
            handleClose();
        }
        catch (error) {
            console.error("Error sending files:", error);
            if (axios.isAxiosError(error)) {
                console.error("Response data:", error.response?.data);
                alert(`Failed to send files: ${error.response?.data?.error || error.message}`);
            } else {
                alert("Failed to send files");
            }
        }
    };
    return (
        <Dialog open={isModalOpen} onOpenChange={handleClose}>
            <DialogContent className="bg-white text-black p-0 overflow-hidden max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader className="pt-8 px-6 flex-shrink-0">
                    <DialogTitle className="text-2xl text-center font-bold">
                        Add attachments
                    </DialogTitle>
                    <DialogDescription className="text-center text-zinc-500">
                        Upload up to {MAX_FILES} files (50MB each)
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex flex-col flex-1 min-h-0 pointer-events-none">
                        <div className="space-y-4 px-6 overflow-y-auto flex-1 pointer-events-auto">
                            <FormField
                                control={form.control}
                                name="fileUrls"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <div className="flex flex-col space-y-4">
                                                {/* Upload Area */}
                                                {uploadedFiles.filter(f => f.status === 'completed').length < MAX_FILES && (
                                                    <div className="flex flex-col items-center justify-center w-full">
                                                        <label 
                                                            htmlFor="file-upload" 
                                                            className="flex flex-col items-center justify-center w-full h-32 border-2 border-zinc-300 border-dashed rounded-lg cursor-pointer bg-zinc-50 hover:bg-zinc-100 transition"
                                                        >
                                                            <div className="flex flex-col items-center justify-center py-4">
                                                                <Upload className="w-8 h-8 mb-2 text-zinc-400" />
                                                                <p className="mb-1 text-sm text-zinc-500">
                                                                    <span className="font-semibold">Click to upload</span> or drag and drop
                                                                </p>
                                                                <p className="text-xs text-zinc-400">
                                                                    {uploadedFiles.filter(f => f.status === 'completed').length}/{MAX_FILES} files • Images, Videos, PDFs, Docs (MAX 50MB)
                                                                </p>
                                                            </div>
                                                            <Input
                                                                id="file-upload"
                                                                type="file"
                                                                multiple
                                                                onChange={handleFileUpload}
                                                                disabled={uploading || uploadedFiles.filter(f => f.status === 'completed').length >= MAX_FILES}
                                                                accept="image/*,application/pdf,.txt,.doc,.docx,.mp4,.webm,.mp3,.wav"
                                                                className="hidden"
                                                            />
                                                        </label>
                                                        
                                                        {/* Progress Bar */}
                                                        {uploading && (
                                                            <div className="w-full mt-4 space-y-2">
                                                                <div className="flex items-center justify-between text-sm">
                                                                    <span className="text-blue-600 flex items-center">
                                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                                        Uploading {uploadedFiles.filter(f => f.status === 'uploading').length} file(s)...
                                                                    </span>
                                                                    <span className="text-zinc-500">{uploadProgress.toFixed(0)}%</span>
                                                                </div>
                                                                <Progress value={uploadProgress} className="w-full" />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* File List */}
                                                {uploadedFiles.length > 0 && (
                                                    <div className="space-y-2">
                                                        <h4 className="text-sm font-medium text-zinc-700">
                                                            Uploaded Files ({uploadedFiles.filter(f => f.status === 'completed').length}/{uploadedFiles.length})
                                                        </h4>
                                                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                                            {uploadedFiles.map((file, index) => (
                                                                <div 
                                                                    key={index}
                                                                    className={`relative flex items-center p-3 border rounded-lg transition group ${
                                                                        file.status === 'completed' ? 'bg-green-50 border-green-200' :
                                                                        file.status === 'error' ? 'bg-red-50 border-red-200' :
                                                                        'bg-blue-50 border-blue-200 animate-pulse'
                                                                    }`}
                                                                >
                                                                    {/* File Icon */}
                                                                    <div className="flex-shrink-0">
                                                                        {getFileIcon(file.fileType)}
                                                                    </div>
                                                                    
                                                                    {/* File Info */}
                                                                    <div className="flex-1 ml-3 min-w-0 overflow-hidden">
                                                                        <div className="flex items-center gap-2">
                                                                            <p className="text-sm font-medium text-zinc-900 truncate max-w-[280px]">
                                                                                {file.fileName}
                                                                            </p>
                                                                            {/* Status Icon */}
                                                                            {file.status === 'uploading' && (
                                                                                <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
                                                                            )}
                                                                            {file.status === 'completed' && (
                                                                                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                                                                            )}
                                                                            {file.status === 'error' && (
                                                                                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-2 text-xs">
                                                                            <span className="text-zinc-500">
                                                                                {formatFileSize(file.fileSize)} • {file.fileType.split('/')[1]?.toUpperCase()}
                                                                            </span>
                                                                            {file.status === 'uploading' && (
                                                                                <span className="text-blue-600 font-medium">
                                                                                    Uploading...
                                                                                </span>
                                                                            )}
                                                                            {file.status === 'error' && (
                                                                                <span className="text-red-600 font-medium">
                                                                                    {file.error || 'Upload failed'}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Preview Link - Only for completed files */}
                                                                    {file.status === 'completed' && file.fileUrl && (
                                                                        <a
                                                                            href={file.fileUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-xs text-blue-600 hover:underline mr-2 hidden group-hover:block"
                                                                        >
                                                                            Preview
                                                                        </a>
                                                                    )}

                                                                    {/* Retry Button - Only for failed files */}
                                                                    {file.status === 'error' && (
                                                                        <button
                                                                            onClick={() => handleRetryFile(index)}
                                                                            type="button"
                                                                            className="flex-shrink-0 bg-orange-500 hover:bg-orange-600 text-white p-1.5 rounded-full shadow-sm transition mr-2"
                                                                            title="Retry upload"
                                                                        >
                                                                            <RefreshCw className="w-3 h-3" />
                                                                        </button>
                                                                    )}
                                                                    
                                                                    {/* Remove Button */}
                                                                    <button
                                                                        title="remove file"
                                                                        onClick={() => handleRemoveFile(index)}
                                                                        type="button"
                                                                        className={`flex-shrink-0 p-1.5 rounded-full shadow-sm transition ${
                                                                            file.status === 'error' 
                                                                                ? 'bg-red-500 hover:bg-red-600' 
                                                                                : 'bg-rose-500 hover:bg-rose-600'
                                                                        } text-white`}
                                                                        disabled={uploading && file.status === 'uploading'}
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                    </form>
                </Form>
                
                <DialogFooter 
                    className="bg-gray-100 px-6 py-4 flex-shrink-0 relative z-50"
                    style={{ pointerEvents: 'auto' }}
                >
                    <Button 
                        disabled={isLoading || uploadedFiles.filter(f => f.status === 'completed').length === 0 || uploading} 
                        variant="default"
                        type="button"
                        className="relative z-50 cursor-pointer"
                        style={{ pointerEvents: 'auto' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            console.log('Button clicked!', { isLoading, uploading, completedFiles: uploadedFiles.filter(f => f.status === 'completed').length });
                            
                            // Call onSubmit directly
                            onSubmit({ fileUrls: [] });
                        }}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Sending {uploadedFiles.filter(f => f.status === 'completed').length} file(s)...
                            </>
                        ) : (
                            <>
                                Send {uploadedFiles.filter(f => f.status === 'completed').length} file{uploadedFiles.filter(f => f.status === 'completed').length > 1 ? 's' : ''}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};