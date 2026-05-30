const ALLOWED_TRANSITIONS = {
  'Submitted': [
    { to: 'Approved', roles: ['Manager'] },
    { to: 'Rejected', roles: ['Manager'] },
    { to: 'Needs Clarification', roles: ['Manager'] }
  ],
  'Needs Clarification': [
    { to: 'Submitted', roles: ['User'] }
  ],
  'Approved': [
    { to: 'Closed', roles: ['Admin'] }
  ],
  'Closed': [
    { to: 'Reopened', roles: ['Admin'] }
  ],
  'Rejected': [],
  'Reopened': [
    { to: 'Approved', roles: ['Manager'] },
    { to: 'Rejected', roles: ['Manager'] },
    { to: 'Needs Clarification', roles: ['Manager'] }
  ]
};

function canTransition(currentStatus, newStatus, role) {
  if (!ALLOWED_TRANSITIONS[currentStatus]) return false;
  
  const transition = ALLOWED_TRANSITIONS[currentStatus].find(t => t.to === newStatus);
  if (!transition) return false;

  return transition.roles.includes(role);
}

module.exports = {
  canTransition,
  ALLOWED_TRANSITIONS
};
