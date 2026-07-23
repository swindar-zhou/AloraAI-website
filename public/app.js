// AloraAI — sign-up form submission.
// Posts to the Node backend (/api/signup); swaps the form for a success panel.

(function () {
  const form = document.getElementById('signup-form');
  if (!form) return;

  const status = document.getElementById('signup-status');
  const submit = document.getElementById('signup-submit');
  const formWrap = document.getElementById('signup-form-wrap');
  const success = document.getElementById('signup-success');

  const setStatus = (msg, kind) => {
    status.textContent = msg || '';
    status.className = 'form-status' + (kind ? ' ' + kind : '');
  };

  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('');

    const data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      organization: form.organization.value.trim(),
      location: form.location.value.trim(),
      linkedin: form.linkedin.value.trim(),
    };

    if (!data.name) return setStatus('Please add your name.', 'error');
    if (!validEmail(data.email)) return setStatus('Please enter a valid work email.', 'error');

    submit.disabled = true;
    const original = submit.textContent;
    submit.textContent = 'Sending…';

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || 'Something went wrong. Please try again.');
      }

      // success — swap panels
      formWrap.classList.add('hidden');
      success.classList.remove('hidden');
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      setStatus(err.message || 'Could not reach the server. Please try again.', 'error');
      submit.disabled = false;
      submit.textContent = original;
    }
  });
})();
