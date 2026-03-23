from auth import AuthService

if __name__ == "__main__":
    auth_service = AuthService()

    username = input("Enter username: ").strip()
    password = input("Enter password: ").strip()

    result = auth_service.authenticate(username, password)

    if result["success"]:
        print("Authentication successful")
        print(result["user"])
    else:
        print(f"Authentication failed: {result['message']}")
