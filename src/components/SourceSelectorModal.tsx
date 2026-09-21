import { useState, useRef, DragEvent } from 'react';
import {
  Folder,
  HardDrive,
  Network,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  Info,
  Trash2,
} from 'lucide-react';
import { PhotoItem, SmbConnectionConfig } from '../types';
import { SAMPLE_PHOTOS } from '../data/samplePhotos';
import { detectFileMetadata } from '../utils/exif';

interface SourceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotosLoaded: (photos: PhotoItem[], sourceName: string) => void;
  currentPhotosCount: number;
}

export function SourceSelectorModal({
  isOpen,
  onClose,
  onPhotosLoaded,
  currentPhotosCount,
}: SourceSelectorModalProps) {
  const [activeTab, setActiveTab] = useState<'local' | 'smb' | 'sample'>('local');

  // Local files state
  const [isScanningLocal, setIsScanningLocal] = useState(false);
  const [localStatusMessage, setLocalStatusMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  // SMB / NAS state
  const [smbConfig, setSmbConfig] = useState<SmbConnectionConfig>({
    host: '192.168.1.100',
    share: 'photos',
    folderPath: '',
    username: '',
    password: '',
    domain: 'WORKGROUP',
    port: 445,
    recursive: true,
  });

  const [isTestingSmb, setIsTestingSmb] = useState(false);
  const [smbTestResult, setSmbTestResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);
  const [isScanningSmb, setIsScanningSmb] = useState(false);

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // Disque Dur Local Handlers
  // -------------------------------------------------------------

  // 1. Modern File System Access API (showDirectoryPicker)
  const handlePickLocalDirectory = async () => {
    setIsScanningLocal(true);
    setLocalStatusMessage('Sélection du dossier en cours...');

    try {
      // Check if modern API is available
      if ('showDirectoryPicker' in window) {
        // @ts-expect-error - File System Access API is modern browser standard
        const dirHandle = await window.showDirectoryPicker();
        setLocalStatusMessage(`Lecture des fichiers dans "${dirHandle.name}"...`);

        const loadedPhotos: PhotoItem[] = [];
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp'];

        // Helper to scan directory with streaming instant launch
        let totalFilesFound = 0;
        let hasLaunched = false;

        async function readDirEntries(dir: any, relativePath: string) {
          for await (const entry of dir.values()) {
            if (entry.kind === 'file') {
              const nameLower = entry.name.toLowerCase();
              if (imageExtensions.some((ext) => nameLower.endsWith(ext))) {
                totalFilesFound++;
                const file = await entry.getFile();
                const objectUrl = URL.createObjectURL(file);

                loadedPhotos.push({
                  id: `local_${Date.now()}_${loadedPhotos.length}_${Math.random().toString(36).substr(2, 6)}`,
                  name: entry.name,
                  url: objectUrl,
                  source: 'local',
                  path: relativePath ? `${relativePath}/${entry.name}` : entry.name,
                  size: file.size,
                  lastModified: file.lastModified,
                });

                // Dès que les 30 premières photos sont répertoriées, on lance le diaporama immédiatement !
                if (!hasLaunched && loadedPhotos.length >= 30) {
                  hasLaunched = true;
                  onPhotosLoaded([...loadedPhotos], `Disque Local (${dirHandle.name}) - Chargement progressif...`);
                  onClose();
                }

                // Tous les 250 fichiers découverts, rafraîchir la progression
                if (totalFilesFound % 250 === 0) {
                  setLocalStatusMessage(`Indexation rapide : ${totalFilesFound} photos trouvées...`);
                }
              }
            } else if (entry.kind === 'directory') {
              // Parcours des sous-dossiers
              await readDirEntries(entry, relativePath ? `${relativePath}/${entry.name}` : entry.name);
            }
          }
        }

        await readDirEntries(dirHandle, dirHandle.name);

        if (loadedPhotos.length === 0) {
          setLocalStatusMessage('Aucune image trouvée dans le dossier sélectionné.');
        } else {
          // Mise à jour finale avec la totalité des photos scannées
          onPhotosLoaded(loadedPhotos, `Disque Local (${dirHandle.name})`);
          if (!hasLaunched) {
            onClose();
          }
        }
      } else {
        // Fallback to hidden input
        folderInputRef.current?.click();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Directory picker error:', err);
        setLocalStatusMessage('Erreur d\'accès au dossier. Vous pouvez utiliser le sélecteur standard ci-dessous.');
      }
    } finally {
      setIsScanningLocal(false);
    }
  };

  // 2. Standard HTML5 directory input fallback
  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    processFileList(Array.from(files), 'Dossier Local');
  };

  // 3. File list or multiple individual images
  const handleFilesInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    processFileList(Array.from(files), 'Photos Locales');
  };

  const processFileList = async (fileArray: File[], sourceLabel: string) => {
    const imageFiles = fileArray.filter((file) => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      setLocalStatusMessage('Aucun fichier image valide sélectionné.');
      return;
    }

    setIsScanningLocal(true);
    setLocalStatusMessage(`Préparation instantanée (${imageFiles.length} photos)...`);

    // Pour 10 000 photos, créer les URL d'objet de façon synchrone et légère
    // sans bloquer avec 10 000 décodages EXIF en amont !
    const photos: PhotoItem[] = imageFiles.map((file, idx) => ({
      id: `local_f_${Date.now()}_${idx}`,
      name: file.name,
      url: URL.createObjectURL(file),
      source: 'local' as const,
      path: (file as any).webkitRelativePath || file.name,
      size: file.size,
      lastModified: file.lastModified,
    }));

    setIsScanningLocal(false);
    onPhotosLoaded(photos, `${sourceLabel} (${photos.length} photos)`);
    onClose();
  };

  // Drag & drop handlers
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      processFileList(droppedFiles, 'Glisser-Déposer Local');
    }
  };

  // -------------------------------------------------------------
  // Partage SMB / NAS Handlers
  // -------------------------------------------------------------

  const handleTestSmb = async () => {
    setIsTestingSmb(true);
    setSmbTestResult(null);

    try {
      const response = await fetch('/api/smb/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smbConfig),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSmbTestResult({
          success: true,
          message: data.message,
          details: `Partage accessible : ${data.share}.`,
        });
      } else {
        setSmbTestResult({
          success: false,
          message: data.message || 'Échec du test de connexion SMB.',
          details: data.rawError,
        });
      }
    } catch (err: any) {
      setSmbTestResult({
        success: false,
        message: 'Impossible de communiquer avec le serveur de l\'application.',
        details: err.message,
      });
    } finally {
      setIsTestingSmb(false);
    }
  };

  const handleScanSmb = async () => {
    setIsScanningSmb(true);
    setSmbTestResult(null);

    try {
      const response = await fetch('/api/smb/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smbConfig),
      });

      const data = await response.json();

      if (response.ok && data.success && Array.isArray(data.photos)) {
        if (data.photos.length === 0) {
          setSmbTestResult({
            success: false,
            message: 'Connexion établie, mais aucune photo (.jpg, .png, etc.) trouvée dans ce dossier.',
          });
        } else {
          const formattedPhotos: PhotoItem[] = data.photos.map((p: any) => ({
            id: p.id,
            name: p.name,
            url: p.url,
            source: 'smb',
            path: `\\\\${smbConfig.host}\\${smbConfig.share}\\${p.path || p.name}`,
          }));

          onPhotosLoaded(
            formattedPhotos,
            `NAS SMB (${smbConfig.host}/${smbConfig.share}${smbConfig.folderPath ? '/' + smbConfig.folderPath : ''})`
          );
          onClose();
        }
      } else {
        setSmbTestResult({
          success: false,
          message: data.message || 'Erreur lors du scan SMB.',
        });
      }
    } catch (err: any) {
      setSmbTestResult({
        success: false,
        message: 'Erreur réseau lors de la communication avec le NAS.',
        details: err.message,
      });
    } finally {
      setIsScanningSmb(false);
    }
  };

  // Demo NAS simulation
  const handleLoadDemoNas = () => {
    const simulatedNasPhotos: PhotoItem[] = SAMPLE_PHOTOS.map((p, idx) => ({
      ...p,
      id: `sim_nas_${idx}`,
      source: 'smb',
      path: `\\\\Synology-DiskStation\\Photos\\Famille\\${p.name}.jpg`,
    }));

    onPhotosLoaded(simulatedNasPhotos, 'NAS SMB (Exemple Synology //Photos/Famille)');
    onClose();
  };

  const handleLoadSampleCollection = () => {
    onPhotosLoaded(SAMPLE_PHOTOS, 'Galerie Démonstration (Haute Résolution)');
    onClose();
  };

  return (
    <div
      id="source-selector-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="source-selector-panel"
        className="w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
          <div>
            <h2 className="text-lg font-semibold text-stone-100 font-['Plus_Jakarta_Sans']">
              Source des photos
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Choisissez d'où proviennent les images affichées par le cadre numérique
            </p>
          </div>
          <button
            id="btn-close-source-modal"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-stone-800 bg-stone-950/50 px-6 pt-2 gap-2">
          <button
            id="tab-source-local"
            onClick={() => setActiveTab('local')}
            className={`flex items-center gap-2 pb-3 px-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'local'
                ? 'border-amber-500 text-amber-400 font-semibold'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            Disque dur local
          </button>

          <button
            id="tab-source-smb"
            onClick={() => setActiveTab('smb')}
            className={`flex items-center gap-2 pb-3 px-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'smb'
                ? 'border-amber-500 text-amber-400 font-semibold'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Network className="w-4 h-4" />
            Partage SMB / NAS
          </button>

          <button
            id="tab-source-sample"
            onClick={() => setActiveTab('sample')}
            className={`flex items-center gap-2 pb-3 px-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'sample'
                ? 'border-amber-500 text-amber-400 font-semibold'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Exemples préchargés
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: LOCAL HARD DRIVE */}
          {activeTab === 'local' && (
            <div className="space-y-5">
              {/* Drag and Drop Box */}
              <div
                id="local-drop-zone"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  isDragOver
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-stone-700 hover:border-stone-600 bg-stone-950/40'
                }`}
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-stone-800 text-amber-400 flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="text-base font-medium text-stone-200">
                  Sélectionnez vos dossiers ou fichiers photos
                </h3>
                <p className="text-xs text-stone-400 max-w-sm mx-auto mt-1 mb-5">
                  Glissez-déposez des photos ici ou choisissez directement un dossier complet sur votre disque dur.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    id="btn-pick-local-folder"
                    onClick={handlePickLocalDirectory}
                    disabled={isScanningLocal}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-medium rounded-lg text-sm transition-colors shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    {isScanningLocal ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Folder className="w-4 h-4" />
                    )}
                    Choisir un dossier complet
                  </button>

                  <button
                    id="btn-pick-local-files"
                    onClick={() => filesInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium rounded-lg text-sm transition-colors border border-stone-700 cursor-pointer"
                  >
                    <HardDrive className="w-4 h-4" />
                    Choisir des fichiers
                  </button>
                </div>

                {/* Hidden input elements */}
                <input
                  type="file"
                  ref={folderInputRef}
                  onChange={handleFolderInputChange}
                  // @ts-expect-error - webkitdirectory is standard for folder picking
                  webkitdirectory=""
                  directory=""
                  multiple
                  className="hidden"
                />
                <input
                  type="file"
                  ref={filesInputRef}
                  onChange={handleFilesInputChange}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
              </div>

              {localStatusMessage && (
                <div
                  id="local-status-msg"
                  className="p-3 bg-stone-800/80 border border-stone-700 rounded-lg text-xs text-stone-300 flex items-center gap-2"
                >
                  <Info className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{localStatusMessage}</span>
                </div>
              )}

              <div className="bg-stone-950/50 border border-stone-800/80 rounded-xl p-4 text-xs text-stone-400 space-y-1">
                <div className="font-semibold text-stone-300">Confidentialité & Vitesse :</div>
                <p>
                  Les photos locales sont chargées directement en mémoire via l'API de fichier de votre navigateur. Aucune image n'est envoyée vers un serveur externe.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: SMB / NAS SHARE */}
          {activeTab === 'smb' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Host */}
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    Adresse IP ou Nom d'hôte du NAS
                  </label>
                  <input
                    id="input-smb-host"
                    type="text"
                    value={smbConfig.host}
                    onChange={(e) => setSmbConfig({ ...smbConfig, host: e.target.value })}
                    placeholder="192.168.1.50 ou synology-nas.local"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-200 text-sm focus:outline-none focus:border-amber-500 font-mono text-xs"
                  />
                </div>

                {/* Share name */}
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    Nom du Partage SMB
                  </label>
                  <input
                    id="input-smb-share"
                    type="text"
                    value={smbConfig.share}
                    onChange={(e) => setSmbConfig({ ...smbConfig, share: e.target.value })}
                    placeholder="ex: photos ou partage"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-200 text-sm focus:outline-none focus:border-amber-500 font-mono text-xs"
                  />
                </div>

                {/* Subfolder */}
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    Sous-dossier (Optionnel)
                  </label>
                  <input
                    id="input-smb-subfolder"
                    type="text"
                    value={smbConfig.folderPath}
                    onChange={(e) => setSmbConfig({ ...smbConfig, folderPath: e.target.value })}
                    placeholder="ex: Famille/2024 ou vide pour la racine"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-200 text-sm focus:outline-none focus:border-amber-500 font-mono text-xs"
                  />
                </div>

                {/* Port */}
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    Port SMB
                  </label>
                  <input
                    id="input-smb-port"
                    type="number"
                    value={smbConfig.port}
                    onChange={(e) => setSmbConfig({ ...smbConfig, port: Number(e.target.value) || 445 })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-200 text-sm focus:outline-none focus:border-amber-500 font-mono text-xs"
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    Utilisateur
                  </label>
                  <input
                    id="input-smb-user"
                    type="text"
                    value={smbConfig.username}
                    onChange={(e) => setSmbConfig({ ...smbConfig, username: e.target.value })}
                    placeholder="ex: admin ou invité"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-200 text-sm focus:outline-none focus:border-amber-500 text-xs"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    Mot de passe
                  </label>
                  <input
                    id="input-smb-pwd"
                    type="password"
                    value={smbConfig.password}
                    onChange={(e) => setSmbConfig({ ...smbConfig, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-200 text-sm focus:outline-none focus:border-amber-500 text-xs"
                  />
                </div>
              </div>

              {/* Recursive checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  id="checkbox-smb-recursive"
                  type="checkbox"
                  checked={smbConfig.recursive}
                  onChange={(e) => setSmbConfig({ ...smbConfig, recursive: e.target.checked })}
                  className="rounded border-stone-700 bg-stone-900 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="checkbox-smb-recursive" className="text-xs text-stone-300">
                  Inclure automatiquement les sous-dossiers (scan récursif)
                </label>
              </div>

              {/* SMB Test Feedback */}
              {smbTestResult && (
                <div
                  id="smb-test-result-box"
                  className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                    smbTestResult.success
                      ? 'bg-emerald-950/50 border-emerald-800/80 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                  }`}
                >
                  {smbTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-medium">{smbTestResult.message}</p>
                    {smbTestResult.details && (
                      <p className="text-[11px] opacity-80">{smbTestResult.details}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons for SMB */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  id="btn-test-smb"
                  onClick={handleTestSmb}
                  disabled={isTestingSmb || isScanningSmb || !smbConfig.host || !smbConfig.share}
                  className="flex items-center gap-2 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-medium rounded-lg border border-stone-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isTestingSmb ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  ) : (
                    <Network className="w-4 h-4 text-amber-400" />
                  )}
                  Tester la connexion
                </button>

                <button
                  id="btn-scan-smb"
                  onClick={handleScanSmb}
                  disabled={isScanningSmb || isTestingSmb || !smbConfig.host || !smbConfig.share}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isScanningSmb ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Folder className="w-4 h-4" />
                  )}
                  Charger les photos du NAS
                </button>

                <button
                  id="btn-demo-nas"
                  onClick={handleLoadDemoNas}
                  className="ml-auto text-xs text-amber-400 hover:text-amber-300 underline underline-offset-4 cursor-pointer"
                >
                  Simuler un partage NAS (Album Famille)
                </button>
              </div>

              {/* Network Tip Box */}
              <div className="p-3 bg-stone-950/60 border border-stone-800 rounded-xl text-xs text-stone-400 space-y-1">
                <div className="font-semibold text-stone-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-400" />
                  Note d'accès réseau :
                </div>
                <p>
                  Les serveurs NAS domestiques (Synology, QNAP, Freebox, TrueNAS, Windows) utilisent le protocole SMB (port 445). En exécution locale chez vous, la connexion est directe et instantanée. Si vous testez depuis cet aperçu dans le cloud, votre adresse IP locale privée (192.168.x.x) n'est pas joignable depuis l'extérieur sans redirection de port ou VPN : vous pouvez utiliser le bouton <em>Simuler un partage NAS</em> pour tester le flux complet.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: SAMPLE PHOTOS */}
          {activeTab === 'sample' && (
            <div className="space-y-4">
              <div className="p-4 bg-stone-950/60 border border-stone-800 rounded-xl">
                <h4 className="text-sm font-semibold text-stone-200 mb-1">
                  Collection de paysages et nature (Haute Définition)
                </h4>
                <p className="text-xs text-stone-400 mb-4">
                  Une sélection de photographies artistiques idéales pour apprécier la fluidité des transitions et le rendu des cadres numériques (bois, aluminium, passe-partout).
                </p>

                <div className="grid grid-cols-4 gap-2 mb-4">
                  {SAMPLE_PHOTOS.slice(0, 4).map((p) => (
                    <div key={p.id} className="aspect-video rounded-md overflow-hidden bg-stone-800">
                      <img
                        src={p.url}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>

                <button
                  id="btn-load-sample-collection"
                  onClick={handleLoadSampleCollection}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-medium rounded-lg text-sm transition-colors cursor-pointer"
                >
                  Charger cette collection de test
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-stone-950/70 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
          <div>
            Photos actuellement dans le cadre :{' '}
            <span className="font-semibold text-stone-200">{currentPhotosCount}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-md transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
