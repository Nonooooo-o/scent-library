import {createRoot} from 'react-dom/client';
import '../styles/fonts.css';
import '../styles/site.css';
import ArchiveApp from '../components/ArchiveApp.jsx';

createRoot(document.getElementById('root')).render(<ArchiveApp/>);
