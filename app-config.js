/* Public browser configuration. Access is restricted by signed-in membership policies.
   Never put a database password or service-role key here. */
window.ATU_CONFIG = {
  supabaseUrl: 'https://ixjcltjdxwpewwopxbtl.supabase.co',
  supabasePublishableKey: 'sb_publishable_ForzPEUYNrqGmdSVPZdTEg_Xf32Ko63',
  sessionId: 'simulation-state',
  reportRuntimeErrors: false,
  storageKey: 'atuSimulationHospitalEHRv1:' + location.pathname.replace(/index\.html$/, '')
};