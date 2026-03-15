from auth import AuthService

def main():
    auth_service = AuthService()
    
    username = input("Enter username: ")
    password = input("Enter password: ")
    
    if auth_service.authenticate(username, password):
        print("Login successful")
    else:
        print("Invalid username or password")
        
if __name__ == "__main__":
    main()