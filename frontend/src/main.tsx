import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { createTheme, ThemeProvider } from '@mui/material/styles';
import {pink, deepOrange} from '@mui/material/colors';

const theme = createTheme({
    palette: {
        primary: pink,
        secondary: deepOrange,
    },
})
createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <ThemeProvider theme={theme}>
    <App onUploadComplete={undefined} />
  </ThemeProvider> </StrictMode>,
)
