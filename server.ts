import express from 'express';
import path from 'path';
import SMB2 from '@marsaud/smb2';
import { createServer as createViteServer } from 'vite';

const appDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory cache of SMB connection params (per session / client)
interface SMBStoredConfig {
  host: string;
  share: string;
  username?: string;
  password?: string;
  domain?: string;
  port?: number;
}

let lastSmbConfig: SMBStoredConfig | null = null;

function normalizeSmbSharePath(host: string, share: string): string {
  // Strip slashes
  const cleanHost = host.trim().replace(/^[\/\\]+/, '').replace(/[\/\\]+$/, '');
  const cleanShare = share.trim().replace(/^[\/\\]+/, '').replace(/[\/\\]+$/, '');
  return `\\\\${cleanHost}\\${cleanShare}`;
}

function getSmbClient(config: SMBStoredConfig): InstanceType<typeof SMB2> {
  const share = normalizeSmbSharePath(config.host, config.share);
  return new SMB2({
    share,
    domain: config.domain || 'WORKGROUP',
    username: config.username || '',
    password: config.password || '',
    port: config.port || 445,
    autoCloseTimeout: 15000,
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.avif',
  '.bmp',
  '.tiff',
  '.heic',
]);

function isImageFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.avif':
      return 'image/avif';
    case '.bmp':
      return 'image/bmp';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

// -------------------------------------------------------------
// SMB API Endpoints
// -------------------------------------------------------------

// 1. Test SMB Connection
app.post('/api/smb/test', async (req, res) => {
  const { host, share, username, password, domain, port } = req.body;

  if (!host || !share) {
    return res.status(400).json({
      success: false,
      message: 'L\'hôte NAS et le nom du partage sont requis.',
    });
  }

  const smbConfig: SMBStoredConfig = { host, share, username, password, domain, port };

  try {
    const smbClient = getSmbClient(smbConfig);
    // Try listing root directory with a 5-second timeout
    const files = await withTimeout(
      smbClient.readdir(''),
      5000,
      `Délai d'attente dépassé (5s) lors de la connexion à ${host}`
    );
    lastSmbConfig = smbConfig;

    const fileList = Array.isArray(files) ? files : [];
    const photoCount = fileList.filter((f: string) => isImageFile(f)).length;

    return res.json({
      success: true,
      message: `Connexion au partage SMB réussie ! (${fileList.length} éléments trouvés, dont ${photoCount} images à la racine)`,
      share: normalizeSmbSharePath(host, share),
      totalItems: fileList.length,
      rootPhotoCount: photoCount,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('SMB Test Error:', error.message || error);
    let userMsg = error.message || 'Échec de connexion au serveur SMB.';
    if (userMsg.includes('ETIMEDOUT') || userMsg.includes('EHOSTUNREACH') || userMsg.includes('ECONNREFUSED')) {
      userMsg = `Délai d'attente dépassé vers ${host}. Si vous utilisez ce cadre photo dans un environnement cloud, votre NAS sur réseau local privé (ex: 192.168.x.x) n'est pas directement joignable sans exposition réseau / VPN / Tailscale. En local sur votre machine, cela se connectera directement.`;
    } else if (userMsg.includes('STATUS_LOGON_FAILURE') || userMsg.includes('Access is denied')) {
      userMsg = 'Échec d\'authentification : nom d\'utilisateur ou mot de passe incorrect sur le NAS.';
    } else if (userMsg.includes('STATUS_BAD_NETWORK_NAME')) {
      userMsg = `Le nom de partage "${share}" n'a pas été trouvé sur le NAS ${host}. Vérifiez la casse et le nom exact du dossier partagé.`;
    }

    return res.status(502).json({
      success: false,
      message: userMsg,
      rawError: error.message,
    });
  }
});

// 2. Browse & Scan SMB Directory for Images
app.post('/api/smb/scan', async (req, res) => {
  const { host, share, username, password, domain, port, folderPath = '', recursive = true } = req.body;

  const smbConfig: SMBStoredConfig = {
    host: host || lastSmbConfig?.host,
    share: share || lastSmbConfig?.share,
    username: username !== undefined ? username : lastSmbConfig?.username,
    password: password !== undefined ? password : lastSmbConfig?.password,
    domain: domain || lastSmbConfig?.domain,
    port: port || lastSmbConfig?.port,
  };

  if (!smbConfig.host || !smbConfig.share) {
    return res.status(400).json({
      success: false,
      message: 'Paramètres SMB manquants.',
    });
  }

  lastSmbConfig = smbConfig;

  try {
    const smbClient = getSmbClient(smbConfig);

    interface FoundPhoto {
      id: string;
      name: string;
      path: string;
      size?: number;
      mtime?: string;
      url: string;
    }

    const foundPhotos: FoundPhoto[] = [];
    const foundDirs: string[] = [];

    // Helper to sanitize path for smb2 library
    const sanitizePath = (p: string) => {
      let clean = p.replace(/\//g, '\\').replace(/^\\+/, '');
      return clean;
    };

    const targetDir = sanitizePath(folderPath);

    // Read target directory with 8s timeout
    const items = await withTimeout(
      smbClient.readdir(targetDir),
      8000,
      `Délai d'attente dépassé lors de la lecture du dossier SMB.`
    );

    for (const item of items) {
      const itemPath = targetDir ? `${targetDir}\\${item}` : item;
      if (isImageFile(item)) {
        foundPhotos.push({
          id: `smb_${Buffer.from(itemPath).toString('base64url')}`,
          name: item,
          path: itemPath,
          url: `/api/smb/file?path=${encodeURIComponent(itemPath)}`,
        });
      } else {
        // May be a directory
        foundDirs.push(item);
      }
    }

    // If recursive is requested and we have subdirs, explore 1 level deep for photos
    if (recursive && foundDirs.length > 0 && foundPhotos.length < 200) {
      for (const dir of foundDirs.slice(0, 15)) {
        try {
          const subDirPath = targetDir ? `${targetDir}\\${dir}` : dir;
          const subItems = await smbClient.readdir(subDirPath);
          for (const subItem of subItems) {
            if (isImageFile(subItem)) {
              const subFilePath = `${subDirPath}\\${subItem}`;
              foundPhotos.push({
                id: `smb_${Buffer.from(subFilePath).toString('base64url')}`,
                name: `${dir} / ${subItem}`,
                path: subFilePath,
                url: `/api/smb/file?path=${encodeURIComponent(subFilePath)}`,
              });
              if (foundPhotos.length >= 300) break;
            }
          }
        } catch {
          // Skip unreadable subdirectories or files
        }
      }
    }

    return res.json({
      success: true,
      currentPath: folderPath,
      photos: foundPhotos,
      directories: foundDirs,
      totalPhotos: foundPhotos.length,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('SMB Scan Error:', error);
    return res.status(502).json({
      success: false,
      message: `Erreur lors de la lecture du dossier SMB : ${error.message || 'Échec d\'accès'}`,
    });
  }
});

// 3. Stream File from SMB Share
app.get('/api/smb/file', async (req, res) => {
  const filePath = req.query.path as string;

  if (!filePath) {
    return res.status(400).send('Chemin de fichier requis.');
  }

  if (!lastSmbConfig) {
    return res.status(400).send('Configuration SMB non initialisée.');
  }

  try {
    const smbClient = getSmbClient(lastSmbConfig);
    const cleanPath = filePath.replace(/\//g, '\\').replace(/^\\+/, '');

    const mime = getMimeType(cleanPath);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');

    // Read buffer from SMB with timeout
    const data = await withTimeout(
      smbClient.readFile(cleanPath),
      15000,
      'Délai de lecture SMB dépassé pour ce fichier.'
    );
    res.send(data);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('SMB File Error:', error.message);
    res.status(404).send(`Photo introuvable sur le partage : ${error.message}`);
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// -------------------------------------------------------------
// Legacy Internet Explorer 10 & Microsoft Surface RT Detection
// -------------------------------------------------------------
function isLegacyIEorSurfaceRT(userAgent: string): boolean {
  if (!userAgent) return false;
  // Match MSIE 9/10/11, Trident/6.0 (IE10), Trident/5.0 (IE9), Windows NT 6.2; ARM (Surface RT)
  return /MSIE (10\.0|9\.0|8\.0)|Trident\/(6\.0|5\.0)|ARM.*Trident|Windows NT 6\.2; ARM/i.test(userAgent);
}

function sendIE10File(res: express.Response) {
  const publicPath = path.join(process.cwd(), 'public', 'ie10.html');
  const distPath = path.join(process.cwd(), 'dist', 'ie10.html');
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(distPath, (err) => {
      if (err) res.sendFile(publicPath);
    });
  } else {
    res.sendFile(publicPath);
  }
}

app.get(['/ie10', '/legacy', '/surface-rt'], (req, res) => {
  sendIE10File(res);
});

// Explicit route to force modern standard version
app.get('/modern', (req, res, next) => {
  req.url = '/?mode=modern';
  next();
});

// Auto-serve legacy page for IE10 / Surface RT user agents when accessing root
app.use((req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  if (req.path === '/' && req.query.mode !== 'modern' && isLegacyIEorSurfaceRT(ua)) {
    return sendIE10File(res);
  }
  next();
});

// -------------------------------------------------------------
// Vite Middleware / Static Asset Serving
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Digital Photo Frame server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
