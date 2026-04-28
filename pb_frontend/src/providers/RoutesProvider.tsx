import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { seoConfigTypes } from '../types/SEOTypes'

import ThemeProvider from './ThemeProvider'
import SEOProvider from './SEOProvider'
// import { SessionProvider } from './SessionProvider'
// import AccessProvider from './AccessProvider'

const Auth      = lazy(() => import('../pages/Auth'))
const Dashboard = lazy(() => import('../pages/Dashboard'))
const Upload     = lazy(() => import('../pages/Upload'))
const Verify     = lazy(() => import('../pages/Verify'))
const PublicVerify = lazy(() => import('../pages/PublicVerify'))
const Documents    = lazy(() => import('../pages/Documents'))
const Credits      = lazy(() => import('../pages/Credits'))
const Transactions = lazy(() => import('../pages/Transactions'))
const Settings  = lazy(() => import('../pages/Settings'))
const Theme     = lazy(() => import('../elements/Theme'))

function RoutesProvider() {
    return (
        <ThemeProvider>
            <BrowserRouter>
                {/* <SessionProvider>
                    <AccessProvider> */}
                        <Suspense fallback={<div className='loader' />}>

                            <Routes>
                                <Route path='/auth' element={<> <Theme /> <SEOProvider {...seoConfigTypes} /> <Auth /> </>} />
                                <Route path='/public/verify' element={<> <Theme /> <SEOProvider {...seoConfigTypes} /> <PublicVerify /> </>} />
                                <Route element={<Dashboard />}>
                                    <Route path='/dashboard' element={null} />
                                    <Route path='/upload'    element={<Upload />} />
                                    <Route path='/verify'    element={<Verify />} />
                                    <Route path='/documents'    element={<Documents />} />
                                    <Route path='/credits'      element={<Credits />} />
                                    <Route path='/transactions' element={<Transactions />} />
                                    <Route path='/settings'     element={<Settings />} />
                                </Route>
                                <Route path='*' element={<Navigate to='/auth' replace />} />
                            </Routes>

                        </Suspense>
                    {/* </AccessProvider>
                </SessionProvider> */}
            </BrowserRouter>
        </ThemeProvider>
    )
}

export default RoutesProvider
