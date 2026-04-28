import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './scss/pb.scss'

import RoutesProvider from './providers/RoutesProvider'
import FreighterProvider from './providers/FreighterProvider'

const container = document.getElementById('pb')

if (!container) {
    throw new Error('Root element #pb not found in DOM')
}

const root = createRoot(container)

root.render(

    <StrictMode>

        <HelmetProvider>

            <FreighterProvider>

                <RoutesProvider />

            </FreighterProvider>

        </HelmetProvider>

    </StrictMode>

)