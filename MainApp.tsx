import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Trees, Camera, Map as MapIcon, BarChart3, Download, Loader2, LogOut } from 'lucide-react';

import type { TreeData, AppView, TreeAnalysisResult } from './types';
import { DataCollectionForm } from './components/DataCollectionForm';
import { MapDisplay } from './components/MapDisplay';
import { Dashboard } from './components/Dashboard';
import { EditTreeModal } from './components/EditTreeModal';
import { analyzeTreeImage } from './services/geminiService';
import { calculateCarbonMetrics } from './services/carbonCalculator';
import { calculateEcosystemServices } from './services/ecosystemServiceCalculator';
import { generatePdfReport } from './services/pdfGenerator';
import { initialTrees } from './constants';

interface MainAppProps {
  onLogout: () => void;
}

const compressImage = (file: File, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

interface BulkUploadProgress {
  total: number;
  processed: number;
  successes: number;
  failures: Array<{ fileName: string, error: string }>;
}


const BulkUploadModal: React.FC<{
  progress: BulkUploadProgress | null;
  onClose: () => void;
}> = ({ progress, onClose }) => {
  if (!progress) return null;

  const isFinished = progress.processed === progress.total;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 fade-in" aria-modal="true" role="dialog">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Proses Unggahan Massal</h2>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-medium text-gray-600">
              {isFinished ? `Proses Selesai` : `Memproses ${progress.processed} dari ${progress.total} gambar...`}
            </p>
            {!isFinished && <Loader2 className="h-5 w-5 text-green-600 animate-spin" />}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-green-600 h-2.5 rounded-full transition-all duration-500" 
              style={{ width: `${(progress.processed / progress.total) * 100}%` }}>
            </div>
          </div>
          <div className="text-sm">
            <p className="text-green-700">Berhasil: {progress.successes}</p>
            <p className="text-red-700">Gagal: {progress.failures.length}</p>
          </div>
          {progress.failures.length > 0 && (
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
              <h3 className="font-semibold text-gray-700">Detail Kegagalan:</h3>
              <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                {progress.failures.map((fail, index) => (
                  <li key={index}>
                    <strong>{fail.fileName}:</strong> {fail.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="p-4 border-t flex justify-end">
          {isFinished && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-lg shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Tutup
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


export const MainApp: React.FC<MainAppProps> = ({ onLogout }) => {
  const [view, setView] = useState<AppView>('form');
  
  const [trees, setTrees] = useState<TreeData[]>(() => {
    try {
      const savedTreesJSON = localStorage.getItem('treeInventoryData');
      if (savedTreesJSON) {
        const savedTrees = JSON.parse(savedTreesJSON);
        if (Array.isArray(savedTrees)) {
          return savedTrees;
        }
      }
    } catch (e) {
      console.error("Could not load trees from localStorage", e);
      localStorage.removeItem('treeInventoryData');
    }
    return initialTrees;
  });

  useEffect(() => {
    try {
      localStorage.setItem('treeInventoryData', JSON.stringify(trees));
    } catch (e) {
      console.error("Could not save trees to localStorage", e);
    }
  }, [trees]);

  const [editingTree, setEditingTree] = useState<TreeData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isBulkUploading, setIsBulkUploading] = useState<boolean>(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState<BulkUploadProgress | null>(null);


  const handleAddTree = useCallback((newTreeData: Omit<TreeData, 'id' | 'carbon' | 'ecosystemServices'>) => {
    const carbonMetrics = calculateCarbonMetrics(newTreeData.dbh, newTreeData.height, newTreeData.condition);
    const ecosystemServices = calculateEcosystemServices(newTreeData.dbh, newTreeData.proximityToBuilding, newTreeData.condition);
    const newTree: TreeData = {
      ...newTreeData,
      id: Date.now(),
      carbon: carbonMetrics,
      ecosystemServices: ecosystemServices,
    };
    setTrees(prevTrees => [newTree, ...prevTrees]);
    setView('dashboard');
  }, []);

  const handleBulkUpload = useCallback(async (files: FileList) => {
    setIsBulkUploading(true);
    setBulkUploadProgress({ total: files.length, processed: 0, successes: 0, failures: [] });

    for (const file of Array.from(files)) {
      try {
        const compressedBase64 = await compressImage(file);
        const analysisResult = await analyzeTreeImage(compressedBase64.split(',')[1], '');
        
        if (!analysisResult || !analysisResult.species || analysisResult.species === 'Tidak Diketahui') {
          throw new Error('AI tidak dapat mengidentifikasi pohon.');
        }
        if (!analysisResult.estimatedDbh || !analysisResult.estimatedHeight) {
            throw new Error('AI tidak dapat mengestimasi dimensi.');
        }
        
        if (!analysisResult.latitude || !analysisResult.longitude) {
            try {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                });
                analysisResult.latitude = position.coords.latitude;
                analysisResult.longitude = position.coords.longitude;
            } catch (geoError) {
                throw new Error('AI tidak menemukan GPS & akses lokasi ditolak.');
            }
        }
        
        const treeData = {
          species: analysisResult.species,
          dbh: analysisResult.estimatedDbh,
          height: analysisResult.estimatedHeight,
          condition: analysisResult.condition,
          proximityToBuilding: 'None' as const,
          notes: 'Ditambahkan melalui unggahan massal.',
          photo: compressedBase64,
          latitude: analysisResult.latitude,
          longitude: analysisResult.longitude,
          inventoryDate: new Date().toISOString(),
        };

        const carbonMetrics = calculateCarbonMetrics(treeData.dbh, treeData.height, treeData.condition);
        const ecosystemServices = calculateEcosystemServices(treeData.dbh, treeData.proximityToBuilding, treeData.condition);
        
        const newTree: TreeData = {
          ...treeData,
          id: Date.now() + Math.random(),
          carbon: carbonMetrics,
          ecosystemServices: ecosystemServices,
        };

        setTrees(prevTrees => [newTree, ...prevTrees]);
        setBulkUploadProgress(prev => prev ? { ...prev, successes: prev.successes + 1 } : null);

      } catch (err: any) {
        setBulkUploadProgress(prev => prev ? { 
          ...prev, 
          failures: [...prev.failures, { fileName: file.name, error: err.message || 'Terjadi kesalahan tidak diketahui.' }] 
        } : null);
      } finally {
        setBulkUploadProgress(prev => prev ? { ...prev, processed: prev.processed + 1 } : null);
      }
    }
  }, []);

  const handleStartEdit = useCallback((tree: TreeData) => {
    setEditingTree(tree);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingTree(null);
  }, []);

  const handleUpdateTree = useCallback((updatedTree: TreeData) => {
    const carbonMetrics = calculateCarbonMetrics(updatedTree.dbh, updatedTree.height, updatedTree.condition);
    const ecosystemServices = calculateEcosystemServices(updatedTree.dbh, updatedTree.proximityToBuilding, updatedTree.condition);
    
    const finalTree = {
        ...updatedTree,
        carbon: carbonMetrics,
        ecosystemServices: ecosystemServices,
    };

    setTrees(prevTrees => 
        prevTrees.map(t => t.id === finalTree.id ? finalTree : t)
    );
    setEditingTree(null);
  }, []);

  const handleImageAnalysis = useCallback(async (base64Image: string, notes: string): Promise<TreeAnalysisResult | null> => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeTreeImage(base64Image, notes);
      return result;
    } catch (err) {
      console.error("Image analysis failed:", err);
      setError("Gagal menganalisis gambar dengan AI. Harap periksa kunci API Anda dan coba lagi.");
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);
  
  const handleGenerateReport = async () => {
      setIsGeneratingReport(true);
      setError(null);
      try {
        await generatePdfReport(trees, '#species-chart-container', '#monetary-chart-container');
      } catch (e) {
        console.error("Failed to generate PDF report:", e);
        setError("Tidak dapat membuat laporan PDF.");
      } finally {
        setIsGeneratingReport(false);
      }
    };


  const NavButton = useMemo(() => ({
    targetView,
    icon: Icon,
    label
  }: {
    targetView: AppView,
    icon: React.ElementType,
    label: string
  }) => (
    <button
      onClick={() => setView(targetView)}
      className={`flex-1 flex flex-col sm:flex-row items-center justify-center p-2 sm:p-3 space-x-2 rounded-full transition-all duration-300 text-sm font-medium ${
        view === targetView
          ? 'bg-green-600 text-white shadow-lg scale-105'
          : 'bg-white text-gray-600 hover:bg-green-100 hover:text-green-700'
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  ), [view]);

  const renderContent = () => {
    switch (view) {
      case 'form':
        return <DataCollectionForm onAddTree={handleAddTree} onAnalyzeImage={handleImageAnalysis} isAnalyzing={isAnalyzing} onBulkUpload={handleBulkUpload} />;
      case 'map':
        return <MapDisplay trees={trees} />;
      case 'dashboard':
        return <Dashboard trees={trees} onEditTree={handleStartEdit} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-green-50/50 font-sans flex flex-col">
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/80 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Trees className="h-8 w-8 text-green-600" />
            <h1 className="text-xl md:text-2xl font-semibold text-gray-800">Inventarisasi Pohon & Karbon</h1>
          </div>
          <div className="flex items-center gap-4">
            {trees.length > 0 && (
               <button
                  onClick={handleGenerateReport}
                  disabled={isGeneratingReport}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 disabled:bg-blue-300 disabled:scale-100"
                >
                  {isGeneratingReport ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                  <span className="hidden sm:inline text-sm font-medium">{isGeneratingReport ? 'Membuat...' : 'Unduh Laporan'}</span>
              </button>
            )}
            <button
              onClick={onLogout}
              className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-all duration-300"
              aria-label="Logout"
            >
              <LogOut className="h-5 w-5" />
              <span className="hidden sm:inline text-sm font-medium">Keluar</span>
            </button>
          </div>
        </div>
      </header>
      
      <main className="flex-grow container mx-auto p-4 pb-24 flex flex-col">
         {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md fade-in" role="alert">
            <p className="font-bold">Kesalahan</p>
            <p>{error}</p>
          </div>
        )}
        <div key={view} className="fade-in">
          {renderContent()}
        </div>
      </main>

      {editingTree && (
        <EditTreeModal 
            tree={editingTree}
            onSave={handleUpdateTree}
            onCancel={handleCancelEdit}
        />
      )}

      {isBulkUploading && (
        <BulkUploadModal
            progress={bulkUploadProgress}
            onClose={() => setIsBulkUploading(false)}
        />
      )}


      <footer className="sticky bottom-0 bg-white/80 backdrop-blur-lg shadow-[0_-2px_10px_rgba(0,0,0,0.05)] p-2 z-20">
        <div className="container mx-auto px-2">
            <div className="flex justify-around items-center bg-gray-100 p-1.5 rounded-full gap-2 shadow-inner">
                <NavButton targetView="form" icon={Camera} label="Tambah Pohon" />
                <NavButton targetView="map" icon={MapIcon} label="Tampilan Peta" />
                <NavButton targetView="dashboard" icon={BarChart3} label="Dasbor" />
            </div>
        </div>
      </footer>
    </div>
  );
};
