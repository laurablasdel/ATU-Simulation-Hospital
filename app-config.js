/* This new repository starts in local mode. It never uses the original owner's database.
   For sharing across devices, configure YOUR backend only after access policies are set up.
   Never place a service-role key or database password in this public file. */
window.ATU_CONFIG = {
  supabaseUrl: '',
  supabasePublishableKey: '',
  reportRuntimeErrors: false,
  // Different repository paths on the same GitHub Pages domain get separate saved data.
  storageKey: 'atuSimulationHospitalEHRv1:' + location.pathname.replace(/index\.html$/, '')
};
