<script lang="ts">
  import { ezppfarm } from '@/api/ezpp';

  let username = $state('');
  let password = $state('');

  let errorMessage = $state('');
  let isLoading = $state(false);

  const performLogin = async () => {
    isLoading = true;
    errorMessage = '';

    try {
      const loginResult = await ezppfarm.login(username, password);
        if (loginResult) {
            // Handle successful login, e.g., redirect to the main app or store the token
            console.log('Login successful:', loginResult);
        } else {
            errorMessage = 'Invalid username or password.';
        }
    } catch {
      errorMessage = 'Login failed. Please check your credentials.';
    } finally {
      isLoading = false;
    }
  };
</script>
